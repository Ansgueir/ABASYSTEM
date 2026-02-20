"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getContractsForStudent(studentId: string) {
    return prisma.contract.findMany({
        where: { studentId },
        include: {
            supervisors: {
                include: {
                    supervisor: {
                        include: { user: true }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}

export async function createContract(data: {
    studentId: string
    effectiveDate: string
    supervisorIds: string[]
    mainSupervisorId: string
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office") return { error: "Only Office can create contracts" }

    const contract = await prisma.contract.create({
        data: {
            studentId: data.studentId,
            effectiveDate: new Date(data.effectiveDate),
            status: "ACTIVE",
            supervisors: {
                create: data.supervisorIds.map(supId => ({
                    supervisorId: supId,
                    isMainSupervisor: supId === data.mainSupervisorId
                }))
            }
        }
    })

    revalidatePath(`/office/students/${data.studentId}`)
    return { success: true, contractId: contract.id }
}

export async function updateContract(data: {
    contractId: string
    supervisorIds: string[]
    mainSupervisorId: string
    effectiveDate: string
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office") return { error: "Only Office can edit contracts" }

    // Remove all existing pivot rows and re-create
    await prisma.contractSupervisor.deleteMany({ where: { contractId: data.contractId } })

    await prisma.contract.update({
        where: { id: data.contractId },
        data: {
            effectiveDate: new Date(data.effectiveDate),
            supervisors: {
                create: data.supervisorIds.map(supId => ({
                    supervisorId: supId,
                    isMainSupervisor: supId === data.mainSupervisorId
                }))
            }
        }
    })

    // Fetch studentId for path revalidation
    const contract = await prisma.contract.findUnique({ where: { id: data.contractId } })
    if (contract) revalidatePath(`/office/students/${contract.studentId}`)
    return { success: true }
}

export async function deleteContract(contractId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office") return { error: "Only Office can delete contracts" }

    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    await prisma.contract.delete({ where: { id: contractId } })
    if (contract) revalidatePath(`/office/students/${contract.studentId}`)
    return { success: true }
}
