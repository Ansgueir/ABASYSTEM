"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateStudentNotes(studentId: string, notes: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toUpperCase()
    const userId = (session.user as any).id

    // Authorization: OFFICE, QA or the assigned SUPERVISOR
    let allowed = ["OFFICE", "QA"].includes(role)
    if (!allowed && role === "SUPERVISOR") {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { supervisor: true }
        })
        if (student?.supervisor?.userId === userId) {
            allowed = true
        }
    }

    if (!allowed) return { error: "You are not authorized to edit these notes." }

    try {
        await prisma.student.update({
            where: { id: studentId },
            data: { notes }
        })
        revalidatePath(`/supervisor/students/${studentId}`)
        revalidatePath(`/office/students/${studentId}`)
        return { success: true }
    } catch (error) {
        console.error("Failed to update student notes:", error)
        return { error: "Database error while updating notes." }
    }
}
