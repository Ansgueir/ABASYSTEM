"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const getSessionUser = async () => {
    const session = await auth()
    if (!session?.user) return null
    return {
        id: session.user.id,
        role: (session.user as any).role,
        officeRole: (session.user as any).officeRole
    }
}

export async function fetchSupervisorGroups(supervisorId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }

    const groups = await prisma.supervisorGroup.findMany({
        where: { supervisorId },
        orderBy: { name: 'asc' }
    })
    return { groups }
}

export async function createSupervisorGroup(supervisorId: string, name: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }
    
    try {
        const group = await prisma.supervisorGroup.create({
            data: { supervisorId, name }
        })
        revalidatePath(`/office/supervisors`)
        return { group }
    } catch (e) {
        return { error: "Failed to create group or name already exists in this supervisor context." }
    }
}

export async function updateSupervisorGroup(groupId: string, name: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }
    
    try {
        await prisma.supervisorGroup.update({
            where: { id: groupId },
            data: { name }
        })
        revalidatePath(`/office/supervisors`)
        return { success: true }
    } catch (e) {
        return { error: "Failed to update group. Name may already exist." }
    }
}

export async function deleteSupervisorGroup(groupId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }
    
    try {
        await prisma.supervisorGroup.delete({
            where: { id: groupId }
        })
        revalidatePath(`/office/supervisors`)
        return { success: true }
    } catch (e) {
        return { error: "Failed to delete group. It may have active sessions." }
    }
}

export async function getStudentsByGroup(groupId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }
    
    const allActiveStudents = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true, email: true }
    })
    
    const groupStudents = await prisma.groupStudent.findMany({
        where: { groupId },
        select: { studentId: true, startDate: true }
    })
    
    const assignedIds = new Set(groupStudents.map(g => g.studentId))
    
    const assigned = allActiveStudents.filter(s => assignedIds.has(s.id)).map(s => {
        const matching = groupStudents.find(g => g.studentId === s.id)
        return { ...s, startDate: matching ? matching.startDate.toISOString() : null }
    })
    const unassigned = allActiveStudents.filter(s => !assignedIds.has(s.id))
    
    return { assigned, unassigned }
}

export async function toggleStudentGroupAssignment(groupId: string, studentId: string, action: 'assign' | 'remove', startDateStr: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }

    try {
        if (action === 'assign') {
             // Decode "MM/DD/YYYY"
             const [m, d, y] = startDateStr.split('/')
             const startDate = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
             
             // Check max 10 rule directly against the database to prevent manual overload
             const currentCount = await prisma.groupStudent.count({ where: { groupId } })
             if (currentCount >= 10) return { error: "Maximum capacity (10 students) reached for this group." }

             await prisma.groupStudent.create({
                 data: { groupId, studentId, startDate }
             })
        } else {
             await prisma.groupStudent.deleteMany({
                 where: { groupId, studentId }
             })
        }
        revalidatePath(`/office/supervisors`)
        return { success: true }
    } catch(e) {
        return { error: "Failed to execute structural assignment action. Target might already exist." }
    }
}

export async function programGroupSessions(
    groupId: string,
    supervisorId: string,
    daysOfWeek: number[], // 0=Sun, 1=Mon ... 6=Sat
    startTime: string,    // "HH:MM"
    endTime: string,      // "HH:MM"
    recurrenceMode: 'current' | 'multiple',
    additionalMonths: number
) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) return { error: "Unauthorized" }

    if (daysOfWeek.length === 0) return { error: "Select at least one day of the week." }

    try {
        // Fetch group + students + supervisor
        const group = await prisma.supervisorGroup.findUnique({
            where: { id: groupId },
            include: { 
                students: { where: { status: 'ACTIVE' }, select: { studentId: true } },
                supervisor: { select: { fullName: true } }
            }
        })
        if (!group) return { error: "Group not found." }
        if (group.students.length === 0) return { error: "No active students in this group to program." }

        const studentIds = group.students.map(s => s.studentId)
        const topic = `${group.name} — ${group.supervisor.fullName}`
        const recurrenceId = crypto.randomUUID()

        // Parse times
        const [startH, startM] = startTime.split(':').map(Number)
        const [endH, endM] = endTime.split(':').map(Number)
        let durationMin = (endH * 60 + endM) - (startH * 60 + startM)
        if (durationMin <= 0) durationMin += 1440 // overnight edge
        const durationHours = durationMin / 60

        // Calculate date range
        const today = new Date()
        const rangeStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        
        let rangeEnd: Date
        if (recurrenceMode === 'current') {
            // End of current month
            rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
        } else {
            // End of current month + additionalMonths
            rangeEnd = new Date(today.getFullYear(), today.getMonth() + 1 + additionalMonths, 0)
        }

        // Collect all target dates
        const targetDates: Date[] = []
        const cursor = new Date(rangeStart)
        while (cursor <= rangeEnd) {
            if (daysOfWeek.includes(cursor.getDay())) {
                targetDates.push(new Date(cursor))
            }
            cursor.setDate(cursor.getDate() + 1)
        }

        if (targetDates.length === 0) return { error: "No matching dates found in the selected range." }

        // Create everything in a transaction
        await prisma.$transaction(async (tx) => {
            for (const date of targetDates) {
                const startDateTime = new Date(date)
                startDateTime.setHours(startH, startM, 0, 0)

                // 1. Create the session
                const session = await tx.groupSupervisionSession.create({
                    data: {
                        supervisorId,
                        groupId,
                        recurrenceId,
                        date,
                        startTime: startDateTime,
                        topic,
                        maxStudents: 10
                    }
                })

                // 2. For each student: attendance + supervision hour
                for (const sId of studentIds) {
                    await tx.groupSupervisionAttendance.create({
                        data: {
                            sessionId: session.id,
                            studentId: sId,
                            attended: true
                        }
                    })

                    await tx.supervisionHour.create({
                        data: {
                            studentId: sId,
                            supervisorId,
                            date,
                            startTime: startDateTime,
                            hours: durationHours,
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
        })

        revalidatePath('/office/supervisors')
        revalidatePath('/office/group-supervision')
        revalidatePath('/supervisor/groups')
        return { success: true, sessionsCreated: targetDates.length }
    } catch (e) {
        console.error("Program sessions error:", e)
        return { error: "Failed to program group sessions." }
    }
}
