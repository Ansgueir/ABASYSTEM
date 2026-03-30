"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveFileLocal, deleteFileLocal } from "@/lib/storage"
import { DocumentType } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { sendEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit"

// Max 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"]

const uploadSchema = z.object({
    documentType: z.nativeEnum(DocumentType),
})

export type UploadState = {
    success?: boolean
    error?: string
}

export async function uploadDocument(prevState: UploadState, formData: FormData) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const file = formData.get("file") as File
    const documentTypeStr = formData.get("documentType") as string

    if (!file) return { error: "No file provided" }

    if (file.size > MAX_FILE_SIZE) {
        return { error: "File size exceeds 5MB limit" }
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
        return { error: "Invalid file type. Only PDF and Images are allowed." }
    }

    const validation = uploadSchema.safeParse({ documentType: documentTypeStr })
    if (!validation.success) {
        return { error: "Invalid document type" }
    }

    const documentType = validation.data.documentType

    try {
        // Determine owner (Student or Supervisor)
        const role = String((session.user as any).role).toLowerCase()
        let studentId = null
        let supervisorId = null
        let folder = "others"

        const targetStudentId = formData.get("targetStudentId") as string
        const targetSupervisorId = formData.get("targetSupervisorId") as string

        if (role === "student") {
            const student = await prisma.student.findUnique({ where: { userId: session.user.id } })
            if (!student) return { error: "Profile not found" }
            studentId = student.id
            folder = `students/${studentId}`
        } else if (role === "supervisor") {
            const supervisor = await prisma.supervisor.findUnique({ where: { userId: session.user.id } })
            if (!supervisor) return { error: "Profile not found" }
            supervisorId = supervisor.id
            folder = `supervisors/${supervisorId}`
        } else if (role === "office" || role === "qa") {
            if (targetStudentId) {
                studentId = targetStudentId
                folder = `students/${studentId}`
            } else if (targetSupervisorId) {
                supervisorId = targetSupervisorId
                folder = `supervisors/${supervisorId}`
            } else {
                folder = "admin"
            }
        } else {
            folder = "admin"
        }

        // Save file
        const { url } = await saveFileLocal(file, folder)

        // Save to DB
        const newDoc = await prisma.document.create({
            data: {
                studentId,
                supervisorId,
                documentType,
                fileUrl: url,
                fileName: file.name,
                fileSize: file.size,
                uploadedById: session.user.id
            }
        })

        await logAudit({
            action: "UPLOAD",
            entity: "Document",
            entityId: newDoc.id,
            details: `Uploaded ${documentType} document`,
            newValues: newDoc
        })

        revalidatePath("/student/documents")
        revalidatePath("/supervisor/documents") // If we have one
        if (role === "office" || role === "qa") {
            if (studentId) revalidatePath(`/office/students/${studentId}`)
            if (supervisorId) revalidatePath(`/office/supervisors/${supervisorId}`)
        }

        return { success: true }

    } catch (error) {
        console.error("Upload error:", error)
        return { error: "Failed to upload document" }
    }
}

export async function deleteDocument(documentId: string, reason?: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const doc = await prisma.document.findUnique({
            where: { id: documentId },
            include: { student: { include: { user: true } } }
        })

        if (!doc) return { error: "Document not found" }

        const role = String((session.user as any).role).toLowerCase()
        const officeRole = String((session.user as any).officeRole || "").toLowerCase()
        
        // Ownership check: Student can delete their own. Office can delete any.
        const isOwner = doc.uploadedById === session.user.id
        const isOffice = role === "office" || role === "qa" || officeRole === "super_admin"

        if (!isOwner && !isOffice) {
            return { error: "Unauthorized to delete this document" }
        }

        // Delete from storage
        await deleteFileLocal(doc.fileUrl)

        // Delete from DB
        await prisma.document.delete({
            where: { id: documentId }
        })

        // Notify Student if it's a student document and handled by Office/Supervisor
        if (doc.student?.user?.email && (isOffice || role === "supervisor")) {
            const studentUser = doc.student.user
            
            // Notification
            await (prisma as any).notification.create({
                data: {
                    userId: studentUser.id,
                    title: "Document Deleted",
                    message: `Your document '${doc.fileName}' (${doc.documentType}) has been deleted by an administrator.${reason ? ` Reason: ${reason}` : ''}`,
                    type: "DOCUMENT",
                    link: "/student/documents"
                }
            })

            // Email
            await sendEmail({
                to: studentUser.email,
                subject: `Document Deleted: ${doc.fileName}`,
                html: `
                    <p>Dear ${doc.student.fullName},</p>
                    <p>An administrator has deleted a document from your profile:</p>
                    <ul>
                        <li><b>File:</b> ${doc.fileName}</li>
                        <li><b>Type:</b> ${doc.documentType}</li>
                    </ul>
                    ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ''}
                    <p>Please log in to your dashboard to see more details.</p>
                `
            })
        }

        await logAudit({
            action: "DELETE",
            entity: "Document",
            entityId: documentId,
            details: `Deleted ${doc.documentType} document. Reason: ${reason || 'N/A'}`,
            oldValues: doc
        })

        revalidatePath("/student/documents")
        if (doc.studentId) revalidatePath(`/office/students/${doc.studentId}`)
        if (doc.supervisorId) revalidatePath(`/office/supervisors/${doc.supervisorId}`)
        return { success: true }

    } catch (error) {
        console.error("Delete error:", error)
        return { error: "Failed to delete document" }
    }
}

export async function reviewDocument(documentId: string, status: "APPROVED" | "REJECTED", reason?: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    
    // Only supervisor, office, or super admin can review
    const isSupervisor = role === "supervisor"
    const isOffice = role === "office" || role === "qa"
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN"

    if (!isSupervisor && !isOffice && !isSuperAdmin) {
        return { error: "Unauthorized role" }
    }

    try {
        const oldDoc = await prisma.document.findUnique({ 
            where: { id: documentId },
            include: { student: { include: { user: true } } }
        })

        if (!oldDoc) return { error: "Document not found" }

        const doc = await prisma.document.update({
            where: { id: documentId },
            data: { 
                status,
                rejectionReason: status === "REJECTED" ? reason : null
            }
        })

        // Notify Student
        if (oldDoc.student?.user?.email) {
            const studentUser = oldDoc.student.user
            const statusLabel = status === "APPROVED" ? "Approved" : "Rejected"
            
            // Notification
            await (prisma as any).notification.create({
                data: {
                    userId: studentUser.id,
                    title: `Document ${statusLabel}`,
                    message: `Your document '${oldDoc.fileName}' (${oldDoc.documentType}) has been ${statusLabel.toLowerCase()}.${reason ? ` Reason: ${reason}` : ''}`,
                    type: "DOCUMENT",
                    link: "/student/documents"
                }
            })

            // Email
            await sendEmail({
                to: studentUser.email,
                subject: `Document Update: ${statusLabel}`,
                html: `
                    <p>Dear ${oldDoc.student.fullName},</p>
                    <p>Your document update status is now: <b>${statusLabel}</b></p>
                    <ul>
                        <li><b>File:</b> ${oldDoc.fileName}</li>
                        <li><b>Type:</b> ${oldDoc.documentType}</li>
                    </ul>
                    ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ''}
                    <p>Please log in to your dashboard to see more details.</p>
                `
            })
        }

        await logAudit({
            action: "UPDATE",
            entity: "Document",
            entityId: documentId,
            details: `Reviewed document as ${status}. Reason: ${reason || 'N/A'}`,
            oldValues: oldDoc,
            newValues: doc
        })

        if (doc.studentId) {
            revalidatePath(`/supervisor/students/${doc.studentId}`)
            revalidatePath(`/office/students/${doc.studentId}`)
            revalidatePath("/student/documents")
        }

        return { success: true }
    } catch (error) {
        console.error("Review error:", error)
        return { error: "Failed to review document" }
    }
}
