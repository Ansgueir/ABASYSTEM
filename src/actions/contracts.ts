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

import { sendEmail } from "@/lib/email"

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

    const student = await prisma.student.findUnique({
        where: { id: data.studentId },
        include: { user: true }
    })
    if (!student) return { error: "Student not found" }

    const contract = await prisma.contract.create({
        data: {
            studentId: data.studentId,
            effectiveDate: new Date(data.effectiveDate),
            status: "SENT",
            supervisors: {
                create: data.supervisorIds.map(supId => ({
                    supervisorId: supId,
                    isMainSupervisor: supId === data.mainSupervisorId
                }))
            }
        }
    })

    // Create DB notification
    await (prisma as any).notification.create({
        data: {
            userId: student.userId,
            title: "New Contract Needs Signature",
            message: "A new supervision contract has been generated for you. Please review and approve it.",
            type: "CONTRACT",
            link: "/student/contracts"
        }
    })

    // Send Email
    await sendEmail({
        to: student.email,
        subject: "Action Required: New Supervision Contract",
        html: `
            <h2>New Supervision Contract</h2>
            <p>Hello ${student.fullName},</p>
            <p>A new ABA supervision contract has been generated for you with an effective date of ${data.effectiveDate}.</p>
            <p>Please log in to your dashboard to review and sign the contract.</p>
            <p><a href="${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/student/contracts">Go to My Contracts</a></p>
        `
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

export async function approveContract(contractId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const student = await prisma.student.findUnique({ where: { userId: (session.user as any).id } })
    if (!student) return { error: "Student not found" }

    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    if (!contract || contract.studentId !== student.id) return { error: "Contract not found" }

    await prisma.contract.update({
        where: { id: contractId },
        data: { status: "ACTIVE" } // Approved -> ACTIVE and ready for use
    })

    revalidatePath("/student/contracts")
    return { success: true }
}

export async function rejectContract(contractId: string, reason: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const student = await prisma.student.findUnique({ where: { userId: (session.user as any).id } })
    if (!student) return { error: "Student not found" }

    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    if (!contract || contract.studentId !== student.id) return { error: "Contract not found" }

    await prisma.contract.update({
        where: { id: contractId },
        data: { status: "DRAFT" } // Rejected -> Draft (office can edit and resend)
    })

    // Optionally create a notification to OFFICE that contract was rejected with `reason`
    const officeUsers = await prisma.user.findMany({ where: { role: "OFFICE" } })
    if (officeUsers.length > 0) {
        await (prisma as any).notification.createMany({
            data: officeUsers.map(u => ({
                userId: u.id,
                title: "Contract Rejected",
                message: `${student.fullName} rejected a contract. Reason: ${reason}`,
                type: "CONTRACT",
                link: `/office/students/${student.id}`
            }))
        })
    }

    revalidatePath("/student/contracts")
    return { success: true }
}
