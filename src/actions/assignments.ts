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

export async function getGroupStudents(supervisorId: string) {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        const allStudents = await prisma.student.findMany({
            where: { status: 'ACTIVE' },
            select: { 
                id: true, 
                fullName: true, 
                email: true, 
                supervisors: true 
            }
        })

        const assigned = allStudents.filter(s => s.supervisors.some(as => as.supervisorId === supervisorId && as.isPrimary === false))
        const unassigned = allStudents.filter(s => !s.supervisors.some(as => as.supervisorId === supervisorId && as.isPrimary === false))

        return { unassigned, assigned }
    } catch (error) {
        console.error("Failed to fetch group students", error)
        return { error: "Failed to fetch group students" }
    }
}

export async function toggleGroupStudentAssignment(studentId: string, supervisorId: string, action: 'assign' | 'remove') {
    const currentUser = await getSessionUser()
    if (!currentUser || (currentUser.role !== "OFFICE" && currentUser.role !== "QA")) {
        return { error: "Unauthorized" }
    }

    try {
        if (action === 'assign') {
            const exists = await prisma.studentSupervisor.findFirst({
                where: { studentId, supervisorId }
            })
            if (!exists) {
                await prisma.studentSupervisor.create({
                    data: { studentId, supervisorId, isPrimary: false }
                })
            } else if (exists.isPrimary) {
                return { error: "Student is already assigned as the PRIMARY student." }
            }
        } else {
            await prisma.studentSupervisor.deleteMany({
                where: { studentId, supervisorId, isPrimary: false }
            })
        }
        revalidatePath("/office/supervisors")
        revalidatePath("/office/supervisors/${supervisorId}")
        return { success: true }
    } catch (error) {
        console.error("Failed updating group assignment", error)
        return { error: "Failed to update group assignment" }
    }
}
