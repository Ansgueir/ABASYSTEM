"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function updateStudentBacbInfo(studentId: string, bacbId: string, fieldworkType: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") {
        return { error: "Only office administrators can edit this information." }
    }

    try {
        await (prisma as any).student.update({
            where: { id: studentId },
            data: {
                bacbId,
                fieldworkType
            }
        })
        revalidatePath(`/office/students/${studentId}`)
        revalidatePath(`/supervisor/students/${studentId}`)
        revalidatePath(`/student/profile`)
        return { success: true }
    } catch (error) {
        console.error("Failed to update student BACB info:", error)
        return { error: "Database error occurred while updating BACB Info." }
    }
}

export async function updateSupervisorBacbId(userId: string, bacbId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    // Security check: Only office or QA can change BACB info
    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") {
        return { error: "Only office administrators can edit this information." }
    }

    try {
        await (prisma as any).supervisor.update({
            where: { userId },
            data: { bacbId }
        })
        revalidatePath(`/supervisor/profile`)
        revalidatePath(`/office/supervisors`)
        return { success: true }
    } catch (error) {
        console.error("Failed to update supervisor BACB info:", error)
        return { error: "Database error occurred while updating BACB Info." }
    }
}
