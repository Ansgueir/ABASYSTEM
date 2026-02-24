"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

const GENERIC_GROUP_LIMIT = 10

export async function createGroupSession(date: Date, startTime: string, topic: string, maxStudents: number = 10, explicitSupervisorId?: string) {
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

        await prisma.groupSupervisionSession.create({
            data: {
                supervisorId: targetSupervisorId,
                date: date,
                startTime: startDateTime,
                topic: topic,
                maxStudents: maxStudents > GENERIC_GROUP_LIMIT ? GENERIC_GROUP_LIMIT : maxStudents // Enforce absolute max
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
