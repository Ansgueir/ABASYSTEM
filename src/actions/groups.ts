"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const GENERIC_GROUP_LIMIT = 10

export async function createGroupSession(date: Date, startTime: string, topic: string, maxStudents: number = 10, explicitSupervisorId?: string, durationMin: number = 60, studentIds: string[] = []) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    let targetSupervisorId = explicitSupervisorId

    try {
        if (role === "supervisor") {
            const supervisor = await prisma.supervisor.findUnique({ where: { userId: session.user.id } })
            if (!supervisor) return { error: "Supervisor profile not found" }
            targetSupervisorId = supervisor.id
        }

        if (!targetSupervisorId) {
            return { error: "Supervisor ID is required for Office/QA" }
        }

        // Start Time Date Object
        const [hours, mins] = startTime.split(':').map(Number)
        const startDateTime = new Date(date)
        startDateTime.setHours(hours, mins, 0, 0)

        const finalMax = maxStudents > GENERIC_GROUP_LIMIT ? GENERIC_GROUP_LIMIT : maxStudents
        const selectedStudents = studentIds.slice(0, finalMax)

        await prisma.$transaction(async (tx) => {
            const groupSession = await tx.groupSupervisionSession.create({
                data: {
                    supervisorId: targetSupervisorId as string,
                    date: date,
                    startTime: startDateTime,
                    topic: topic,
                    maxStudents: finalMax
                }
            })

            // Generate attendance and supervision hours for each student
            for (const sId of selectedStudents) {
                await tx.groupSupervisionAttendance.create({
                    data: {
                        sessionId: groupSession.id,
                        studentId: sId,
                        attended: true
                    }
                })

                await tx.supervisionHour.create({
                    data: {
                        studentId: sId,
                        supervisorId: targetSupervisorId as string,
                        date: date,
                        startTime: startDateTime,
                        hours: durationMin / 60,
                        supervisionType: "GROUP",
                        setting: "OFFICE_CLINIC", // Default setting for group sessions
                        activityType: "RESTRICTED", // Default activity for group sessions commonly, can be queried
                        notes: `Group Session: ${topic}`,
                        groupTopic: topic,
                        status: "PENDING"
                    }
                })
            }
        })

        revalidatePath("/supervisor/groups")
        return { success: true }
    } catch (error) {
        console.error("Create Group Error:", error)
        return { error: "Failed to create group session" }
    }
}

export async function registerStudentToGroup(sessionId: string, studentId: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const groupSession = await prisma.groupSupervisionSession.findUnique({
            where: { id: sessionId },
            include: { attendance: true }
        })

        if (!groupSession) return { error: "Session not found" }

        const currentCount = groupSession.attendance.length
        if (currentCount >= groupSession.maxStudents) {
            return { error: `Session is full (Max ${groupSession.maxStudents} students)` }
        }

        // Check if already registered
        const existing = await prisma.groupSupervisionAttendance.findFirst({
            where: {
                sessionId: sessionId,
                studentId: studentId
            }
        })

        if (existing) return { error: "Student already registered" }

        await prisma.$transaction(async (tx) => {
            await tx.groupSupervisionAttendance.create({
                data: {
                    sessionId: sessionId,
                    studentId: studentId,
                    attended: true
                }
            })

            await tx.supervisionHour.create({
                data: {
                    studentId,
                    supervisorId: groupSession.supervisorId,
                    date: groupSession.date,
                    startTime: groupSession.startTime,
                    hours: 1.0, // Default for single registrations if duration not stored
                    supervisionType: "GROUP",
                    setting: "OFFICE_CLINIC",
                    activityType: "RESTRICTED",
                    notes: `Group Session: ${groupSession.topic}`,
                    groupTopic: groupSession.topic,
                    status: "PENDING"
                }
            })
        })

        revalidatePath("/supervisor/groups")
        revalidatePath("/student/groups")
        return { success: true }

    } catch (error) {
        console.error("Register Group Error:", error)
        return { error: "Failed to register student to group" }
    }
}

export async function updateGroupSession(sessionId: string, date: Date, time: string, topic: string, maxStudents: number, supervisorId: string, studentIds: string[] = [], durationMin: number = 60) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const [hours, mins] = time.split(':').map(Number)
        const startDateTime = new Date(date)
        startDateTime.setHours(hours, mins, 0, 0)

        const finalMax = maxStudents > GENERIC_GROUP_LIMIT ? GENERIC_GROUP_LIMIT : maxStudents
        const selectedStudents = studentIds.slice(0, finalMax)

        await prisma.$transaction(async (tx) => {
            const currentGroup = await tx.groupSupervisionSession.findUnique({
                where: { id: sessionId },
                include: { attendance: true }
            })

            if (!currentGroup) throw new Error("Session not found")

            await tx.groupSupervisionSession.update({
                where: { id: sessionId },
                data: {
                    date,
                    startTime: startDateTime,
                    topic,
                    maxStudents: finalMax,
                    supervisorId
                }
            })

            const existingIds = currentGroup.attendance.map(a => a.studentId)
            const toAdd = selectedStudents.filter(id => !existingIds.includes(id))
            const toRemove = existingIds.filter(id => !selectedStudents.includes(id))

            if (toRemove.length > 0) {
                await tx.groupSupervisionAttendance.deleteMany({
                    where: { sessionId, studentId: { in: toRemove } }
                })
                
                // Cleanup their hours too using same time/date/student matching
                await tx.supervisionHour.deleteMany({
                    where: { 
                        studentId: { in: toRemove },
                        date: currentGroup.date,
                        startTime: currentGroup.startTime,
                        supervisionType: "GROUP"
                    }
                })
            }

            for (const sId of toAdd) {
                await tx.groupSupervisionAttendance.create({
                    data: {
                        sessionId: sessionId,
                        studentId: sId,
                        attended: true
                    }
                })

                await tx.supervisionHour.create({
                    data: {
                        studentId: sId,
                        supervisorId: supervisorId,
                        date: date,
                        startTime: startDateTime,
                        hours: durationMin / 60,
                        supervisionType: "GROUP",
                        setting: "OFFICE_CLINIC",
                        activityType: "RESTRICTED",
                        notes: `Group Session: ${topic}`,
                        groupTopic: topic,
                        status: "PENDING"
                    }
                })
            }
        })

        revalidatePath("/office/group-supervision")
        revalidatePath("/supervisor/groups")
        return { success: true }
    } catch (error) {
        console.error("Update Group Error:", error)
        return { error: "Failed to update group session" }
    }
}

export async function deleteGroupSession(sessionId: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        await prisma.$transaction(async (tx) => {
            const session = await tx.groupSupervisionSession.findUnique({
                where: { id: sessionId },
                include: { attendance: true }
            })

            if (session) {
                const studentIds = session.attendance.map(a => a.studentId)
                await tx.supervisionHour.deleteMany({
                    where: {
                        studentId: { in: studentIds },
                        date: session.date,
                        startTime: session.startTime,
                        supervisionType: "GROUP"
                    }
                })
            }

            await tx.groupSupervisionAttendance.deleteMany({
                where: { sessionId }
            })

            await tx.groupSupervisionSession.delete({
                where: { id: sessionId }
            })
        })

        revalidatePath("/office/group-supervision")
        revalidatePath("/supervisor/groups")
        return { success: true }
    } catch (error) {
        console.error("Delete Group Error:", error)
        return { error: "Failed to delete group session" }
    }
}

export async function deleteGroupSessionChain(sessionId: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const targetSession = await prisma.groupSupervisionSession.findUnique({
            where: { id: sessionId }
        })

        if (!targetSession) return { error: "Session not found" }
        if (!targetSession.recurrenceId) {
            // No chain — just delete the single session
            return deleteGroupSession(sessionId)
        }

        // Delete all sessions of this chain from this date forward
        const futureSessions = await prisma.groupSupervisionSession.findMany({
            where: {
                recurrenceId: targetSession.recurrenceId,
                date: { gte: targetSession.date }
            },
            include: { attendance: true }
        })

        await prisma.$transaction(async (tx) => {
            for (const sess of futureSessions) {
                const studentIds = sess.attendance.map(a => a.studentId)
                await tx.supervisionHour.deleteMany({
                    where: {
                        studentId: { in: studentIds },
                        date: sess.date,
                        startTime: sess.startTime,
                        supervisionType: "GROUP"
                    }
                })
                await tx.groupSupervisionAttendance.deleteMany({
                    where: { sessionId: sess.id }
                })
                await tx.groupSupervisionSession.delete({
                    where: { id: sess.id }
                })
            }
        })

        revalidatePath("/office/group-supervision")
        revalidatePath("/supervisor/groups")
        return { success: true, deletedCount: futureSessions.length }
    } catch (error) {
        console.error("Delete Chain Error:", error)
        return { error: "Failed to delete session chain" }
    }
}

export async function updateGroupSessionChain(
    sessionId: string,
    newTime: string,    // "HH:MM"
    topic: string,
    maxStudents: number,
    supervisorId: string,
    durationMin: number = 60
) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const targetSession = await prisma.groupSupervisionSession.findUnique({
            where: { id: sessionId }
        })

        if (!targetSession) return { error: "Session not found" }
        if (!targetSession.recurrenceId) {
            // No chain — fall back to single update (no student changes in chain mode)
            return updateGroupSession(sessionId, targetSession.date, newTime, topic, maxStudents, supervisorId, [], durationMin)
        }

        const [h, m] = newTime.split(':').map(Number)
        const finalMax = maxStudents > GENERIC_GROUP_LIMIT ? GENERIC_GROUP_LIMIT : maxStudents

        // Get all future sessions in this chain
        const futureSessions = await prisma.groupSupervisionSession.findMany({
            where: {
                recurrenceId: targetSession.recurrenceId,
                date: { gte: targetSession.date }
            },
            include: { attendance: true }
        })

        await prisma.$transaction(async (tx) => {
            for (const sess of futureSessions) {
                // Build new startTime preserving the original date, only changing the clock time
                const newStart = new Date(sess.date)
                newStart.setUTCHours(h, m, 0, 0)

                // Update session metadata
                await tx.groupSupervisionSession.update({
                    where: { id: sess.id },
                    data: {
                        startTime: newStart,
                        topic,
                        maxStudents: finalMax,
                        supervisorId
                    }
                })

                // Update supervision hours for all students of this session
                const studentIds = sess.attendance.map(a => a.studentId)
                if (studentIds.length > 0) {
                    // Delete old hours matching original time
                    await tx.supervisionHour.deleteMany({
                        where: {
                            studentId: { in: studentIds },
                            date: sess.date,
                            startTime: sess.startTime,
                            supervisionType: "GROUP"
                        }
                    })
                    // Re-create with new time and topic
                    for (const sId of studentIds) {
                        await tx.supervisionHour.create({
                            data: {
                                studentId: sId,
                                supervisorId,
                                date: sess.date,
                                startTime: newStart,
                                hours: durationMin / 60,
                                supervisionType: "GROUP",
                                setting: "OFFICE_CLINIC",
                                activityType: "RESTRICTED",
                                notes: `Group Session: ${topic}`,
                                groupTopic: topic,
                                status: "PENDING"
                            }
                        })
                    }
                }
            }
        })

        revalidatePath("/office/group-supervision")
        revalidatePath("/supervisor/groups")
        return { success: true, updatedCount: futureSessions.length }
    } catch (error) {
        console.error("Update Chain Error:", error)
        return { error: "Failed to update session chain" }
    }
}
