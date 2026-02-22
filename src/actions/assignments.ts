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

export async function getManageableStudents(supervisorId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const unassigned = await prisma.student.findMany({
            where: { supervisorId: null },
            select: { id: true, fullName: true, email: true }
        })

        const assigned = await prisma.student.findMany({
            where: { supervisorId },
            select: { id: true, fullName: true, email: true }
        })

        return { unassigned, assigned }
    } catch (error) {
        console.error("Failed to fetch students", error)
        return { error: "Failed to fetch students" }
    }
}

export async function assignStudentToSupervisor(studentId: string, supervisorId: string | null) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        await prisma.student.update({
            where: { id: studentId },
            data: { supervisorId }
        })

        revalidatePath("/office/supervisors")
        return { success: true }
    } catch (error) {
        console.error("Assignment failed", error)
        return { error: "Failed to assign student" }
    }
}
