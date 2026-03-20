"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import fs from "fs"
import path from "path"

/**
 * PURGE USER ACTION
 * Strictly restricted to qa-super@abasystem.com
 * Performs physical deletion of all user data and files.
 */
export async function purgeUser(userId: string) {
    const session = await auth()
    
    // STRICT SECURITY CHECK
    if (session?.user?.email !== 'qa-super@abasystem.com') {
        console.error(`[SECURITY] Unauthorized purge attempt by ${session?.user?.email} on user ${userId}`)
        return { error: "Access Denied: Specialized administrator role required for this operation." }
    }

    if (!userId) return { error: "User ID is required" }

    try {
        console.log(`[PURGE] Starting physical destruction of user ${userId}...`)

        // 1. Fetch user and related entities to identify files
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                student: {
                    include: {
                        documents: true,
                        contracts: true
                    }
                },
                supervisor: {
                    include: {
                        documents: true
                    }
                },
                officeMember: true,
                uploadedDocuments: true
            }
        })

        if (!user) return { error: "User not found" }

        // 2. Collect file paths to delete
        const filesToDelete: string[] = []
        
        // Document files
        const allDocs = [
            ...(user.student?.documents || []),
            ...(user.supervisor?.documents || []),
            ...(user.uploadedDocuments || [])
        ]
        
        allDocs.forEach(doc => {
            if (doc.fileUrl && !doc.fileUrl.startsWith('http')) {
                filesToDelete.push(doc.fileUrl)
            }
        })

        // 3. Execution of database destruction via Transaction
        await prisma.$transaction(async (tx) => {
            // Delete hour logs
            if (user.student) {
                await tx.independentHour.deleteMany({ where: { studentId: user.student.id } })
                // Cascading delete for StudentSupervisor assignments
                await tx.studentSupervisor.deleteMany({ where: { studentId: user.student.id } })
                // Delete evaluations
                await tx.studentEvaluation.deleteMany({ where: { studentId: user.student.id } })
                // Delete payments
                await tx.studentPayment.deleteMany({ where: { studentId: user.student.id } })
                // Delete invoices
                await tx.invoice.deleteMany({ where: { studentId: user.student.id } })
                // Delete group attendance
                await tx.groupSupervisionAttendance.deleteMany({ where: { studentId: user.student.id } })
                // Contracts
                await tx.contract.deleteMany({ where: { studentId: user.student.id } })
            }

            if (user.supervisor) {
                await tx.supervisionHour.deleteMany({ where: { supervisorId: user.supervisor.id } })
                await tx.studentSupervisor.deleteMany({ where: { supervisorId: user.supervisor.id } })
                await tx.groupSupervisionSession.deleteMany({ where: { supervisorId: user.supervisor.id } })
                // Supervisor payments
                await tx.supervisorPayment.deleteMany({ where: { supervisorId: user.supervisor.id } })
            }

            // Delete documents
            await tx.document.deleteMany({ 
                where: { 
                    OR: [
                        { studentId: user.student?.id },
                        { supervisorId: user.supervisor?.id },
                        { uploadedById: user.id }
                    ]
                }
            })

            // Delete specific Profiles
            if (user.student) await tx.student.delete({ where: { id: user.student.id } })
            if (user.supervisor) await tx.supervisor.delete({ where: { id: user.supervisor.id } })
            if (user.officeMember) await tx.officeMember.delete({ where: { id: user.officeMember.id } })

            // Delete System entities
            await tx.notification.deleteMany({ where: { userId: user.id } })
            await tx.auditLog.deleteMany({ where: { userId: user.id } })
            await tx.repeatingSchedule.deleteMany({ where: { userId: user.id } })

            // FINALLY: Delete the User
            await tx.user.delete({ where: { id: user.id } })
        })

        // 4. Physical file deletion (best effort)
        for (const filePath of filesToDelete) {
            try {
                const absolutePath = path.join(process.cwd(), filePath)
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath)
                    console.log(`[PURGE] Deleted file: ${absolutePath}`)
                }
            } catch (fileErr) {
                console.warn(`[PURGE] Failed to delete physical file ${filePath}:`, fileErr)
            }
        }

        console.log(`[PURGE] User ${userId} successfully purged from system.`)
        revalidatePath("/office/vault")
        return { success: true }

    } catch (error) {
        console.error("[PURGE] Crash during user destruction:", error)
        return { error: "An internal error occurred during data destruction. Some records might remain." }
    }
}
