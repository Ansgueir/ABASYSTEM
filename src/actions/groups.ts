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

        await prisma.groupSupervisionAttendance.create({
            data: {
                sessionId: sessionId,
                studentId: studentId,
                attended: true // Default to true or pending? Schema says default true
            }
        })

        revalidatePath("/supervisor/groups")
        revalidatePath("/student/groups")
        return { success: true }

    } catch (error) {
        console.error("Register Group Error:", error)
        return { error: "Failed to register student to group" }
    }
}
