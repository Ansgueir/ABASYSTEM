"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { saveFileLocal, deleteFileLocal } from "@/lib/storage"
import { DocumentType } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

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
        await prisma.document.create({
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

export async function deleteDocument(documentId: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const doc = await prisma.document.findUnique({
            where: { id: documentId }
        })

        if (!doc) return { error: "Document not found" }

        const role = String((session.user as any).role).toLowerCase()
        // Check ownership
        // Ideally verify user owns the profile linked to the doc
        // For simplicity allow if logged in user uploaded it or owns profile
        // But uploadedById is safer
        if (doc.uploadedById !== session.user.id && role !== "office" && role !== "qa") {
            // Check role based override (e.g. admin)
            return { error: "Unauthorized to delete this document" }
        }

        // Delete from storage
        await deleteFileLocal(doc.fileUrl)

        // Delete from DB
        await prisma.document.delete({
            where: { id: documentId }
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

export async function reviewDocument(documentId: string, status: "APPROVED" | "REJECTED") {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    // Only supervisor or office can review
    if (role !== "supervisor" && role !== "office") {
        return { error: "Unauthorized role" }
    }

    try {
        const doc = await prisma.document.update({
            where: { id: documentId },
            data: { status }
        })

        if (doc.studentId) {
            revalidatePath(`/supervisor/students/${doc.studentId}`)
            revalidatePath("/student/documents")
        }

        return { success: true }
    } catch (error) {
        console.error("Review error:", error)
        return { error: "Failed to review document" }
    }
}
