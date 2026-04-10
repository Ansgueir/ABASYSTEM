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
