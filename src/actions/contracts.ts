"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { DocumentType, DocumentStatus, ContractStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export type ContractState = {
    success?: boolean
    error?: string
    contractUrl?: string
}

export async function generateContractAction(studentId: string): Promise<ContractState> {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    try {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            include: { documents: true }
        })

        if (!student) return { error: "Student not found" }

        // 1. Validation Logic (Blocking)
        const missingRequirements = []

        // Check BACB ID
        if (!student.bacbId || student.bacbId.trim() === "") {
            missingRequirements.push("BACB ID is missing")
        }

        // Helper to check approved doc
        const hasApprovedDoc = (type: DocumentType) => {
            return student.documents.some(d => d.documentType === type && d.status === DocumentStatus.APPROVED)
        }

        // Check Documents
        if (!hasApprovedDoc(DocumentType.IDENTIFICATION)) missingRequirements.push("Identification (Approved)")
        if (!hasApprovedDoc(DocumentType.PROOF_START_DATE)) missingRequirements.push("Proof of Start Date (Approved)")
        if (!hasApprovedDoc(DocumentType.ACADEMIC_DEGREE)) missingRequirements.push("Academic Degree (Approved)")

        if (missingRequirements.length > 0) {
            return { error: `Cannot generate contract. Missing requirements: ${missingRequirements.join(", ")}` }
        }

        // 2. Generate Contract (Mockup for now, assuming external service or PDF generation lib)
        // In real app: Generate PDF -> Upload to Storage -> Get URL
        const mockContractUrl = `/documents/contracts/contract_${student.id}_${Date.now()}.pdf`

        // 3. Save to DB
        await prisma.contract.create({
            data: {
                studentId: student.id,
                effectiveDate: new Date(),
                contractUrl: mockContractUrl,
                status: ContractStatus.GENERATED
            }
        })

        revalidatePath("/student/profile")
        revalidatePath(`/supervisor/students/${studentId}`)

        return { success: true, contractUrl: mockContractUrl }

    } catch (error) {
        console.error("Contract Error:", error)
        return { error: "Failed to generate contract" }
    }
}
