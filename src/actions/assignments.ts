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
        const allStudents = await prisma.student.findMany({
            select: { 
                id: true, 
                fullName: true, 
                email: true, 
                supervisors: true 
            }
        })

        const unassigned = allStudents.filter(s => s.supervisors.length === 0)
        const assigned = allStudents.filter(s => s.supervisors.some(as => as.supervisorId === supervisorId))

        return { unassigned, assigned }
    } catch (error) {
        console.error("Failed to fetch students", error)
        return { error: "Failed to fetch students" }
    }
}

export async function updateStudentAssignments(
    studentId: string, 
    primarySupervisorId: string | null, 
    additionalSupervisorIds: string[]
) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    if (primarySupervisorId && additionalSupervisorIds.includes(primarySupervisorId)) {
        return { error: "Primary supervisor cannot be an additional supervisor." }
    }

    try {
        await (prisma as any).$transaction(async (tx: any) => {
            // Remove all existing assignments
            await tx.studentSupervisor.deleteMany({
                where: { studentId }
            })

            const assignments = []
            if (primarySupervisorId) {
                assignments.push({
                    studentId,
                    supervisorId: primarySupervisorId,
                    isPrimary: true
                })
            }

            for (const supId of additionalSupervisorIds) {
                assignments.push({
                    studentId,
                    supervisorId: supId,
                    isPrimary: false
                })
            }

            if (assignments.length > 0) {
                await tx.studentSupervisor.createMany({
                    data: assignments
                })
            }

            // Sync legacy supervisorId field for backward compatibility and UI consistency
            await tx.student.update({
                where: { id: studentId },
                data: { supervisorId: primarySupervisorId }
            })
        })

        revalidatePath("/office/supervisors")
        revalidatePath("/office/students")
        revalidatePath(`/office/students/${studentId}`)
        return { success: true }
    } catch (error) {
        console.error("Assignment failed", error)
        return { error: "Failed to update supervisor assignments" }
    }
}

export async function assignStudentToSupervisor(studentId: string, supervisorId: string | null) {
    // Kept for backward compatibility, but it will handle it via the new structure as Primary
    return updateStudentAssignments(studentId, supervisorId, [])
}
