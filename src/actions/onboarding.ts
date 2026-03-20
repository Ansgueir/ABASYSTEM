"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { CredentialType } from "@prisma/client"

const contactSchema = z.object({
    phone: z.string().min(10, "Phone number must be valid"),
    address: z.string().min(5, "Address must be valid"),
    city: z.string().optional(),
    state: z.string().optional(),

    // Student specific
    bacbId: z.string().optional(),
    credential: z.string().optional(),
    vcsSequence: z.string().optional(),

    // Supervisor specific
    certificantNumber: z.string().optional(),
    qualificationLevel: z.string().optional(),
    dateQualified: z.string().optional(),
    examDate: z.string().optional()
})

const signatureSchema = z.object({
    signatureData: z.string().min(1, "Signature is required"),
    initialsData: z.string().min(1, "Initials are required")
})

export async function getOnboardingState() {
    const session = await auth()
    if (!session?.user?.id) return null

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
            student: true,
            supervisor: true
        }
    })

    if (!user) return null

    // Determine current values if any
    let currentPhone = ""
    let currentAddress = ""
    let role = user.role

    if (user.student) {
        currentPhone = user.student.phone
        currentAddress = user.student.address
    } else if (user.supervisor) {
        currentPhone = user.supervisor.phone
        currentAddress = user.supervisor.address
    }

    return {
        step: user.onboardingStep,
        role: user.role,
        currentPhone,
        currentAddress,
        fullName: user.student?.fullName || user.supervisor?.fullName || user.email,
        email: user.email,
        completed: user.onboardingCompleted
    }
}

export async function submitContactInfo(prevState: any, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const rawData = {
        phone: formData.get("phone") as string,
        address: formData.get("address") as string,
        city: formData.get("city") as string,
        state: formData.get("state") as string,

        bacbId: formData.get("bacbId") as string,
        credential: formData.get("credential") as string,
        vcsSequence: formData.get("vcsSequence") as string,

        certificantNumber: formData.get("certificantNumber") as string,
        qualificationLevel: formData.get("qualificationLevel") as string,
        dateQualified: formData.get("dateQualified") as string,
        examDate: formData.get("examDate") as string,
    }

    const validate = contactSchema.safeParse(rawData)
    if (!validate.success) {
        return { error: "Validation failed", fieldErrors: validate.error.flatten().fieldErrors }
    }

    const d = validate.data

    try {
        const userRole = (session.user as any).role?.toUpperCase()
        if (userRole === "STUDENT") {
            if (!d.bacbId || !d.credential || !d.city || !d.state) {
                return { error: "Missing required fields for student registration: BACB ID, Credential, City or State" }
            }

            await prisma.student.upsert({
                where: { userId: session.user.id },
                create: {
                    userId: session.user.id,
                    fullName: session.user.name || "Student",
                    email: session.user.email || "",
                    phone: d.phone,
                    address: d.address,
                    city: d.city,
                    state: d.state,
                    bacbId: d.bacbId,
                    credential: (d.credential === "STUDENT" ? "NO_CREDENTIAL" : d.credential) as CredentialType,
                    vcsSequence: d.vcsSequence || null,
                    school: "TBD", // Mandatory field default
                    level: "BCBA", // Mandatory field default
                    startDate: new Date(), // Mandatory field default
                    supervisionType: "REGULAR", // Mandatory field default
                    supervisionPercentage: 0.05, // Standard 5%
                    hoursToDo: 0,
                    hoursToPay: 0,
                    amountToPay: 0,
                    hoursPerMonth: 0,
                    totalMonths: 0,
                    endDate: new Date(),
                },
                update: {
                    phone: d.phone,
                    address: d.address,
                    city: d.city,
                    state: d.state,
                    bacbId: d.bacbId,
                    credential: (d.credential === "STUDENT" ? "NO_CREDENTIAL" : d.credential) as CredentialType,
                    vcsSequence: d.vcsSequence || null,
                }
            })
        } else if (userRole === "SUPERVISOR") {
            if (!d.certificantNumber || !d.qualificationLevel || !d.dateQualified || !d.examDate) {
                return { error: "Missing required fields for supervisor registration: Cert#, Qualification Level, or passing Dates" }
            }

            const fullAddress = d.city && d.state ? `${d.address}, ${d.city}, ${d.state}` : d.address

            await prisma.supervisor.upsert({
                where: { userId: session.user.id },
                create: {
                    userId: session.user.id,
                    fullName: session.user.name || "Supervisor",
                    email: session.user.email || "",
                    phone: d.phone,
                    address: fullAddress,
                    certificantNumber: d.certificantNumber,
                    bacbId: d.certificantNumber, // Use cert# as default bacbId
                    credentialType: d.qualificationLevel as CredentialType,
                    dateQualified: new Date(d.dateQualified),
                    examDate: new Date(d.examDate),
                },
                update: {
                    phone: d.phone,
                    address: fullAddress,
                    certificantNumber: d.certificantNumber,
                    credentialType: d.qualificationLevel as CredentialType,
                    dateQualified: new Date(d.dateQualified),
                    examDate: new Date(d.examDate),
                }
            })
        }

        await prisma.user.update({
            where: { id: session.user.id },
            data: { onboardingStep: 2 }
        })

        revalidatePath("/onboarding")
        return { success: true }
    } catch (error) {
        console.error("Error updating contact info:", error)
        return { error: "Failed to update profile: " + (error instanceof Error ? error.message : "Unknown db error") }
    }
}

export async function submitTerms(prevState: any, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const accepted = formData.get("accepted") === "on"
    if (!accepted) {
        return { error: "You must accept the terms and conditions" }
    }

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { onboardingStep: 3 }
        })

        revalidatePath("/onboarding")
        return { success: true }
    } catch (error) {
        return { error: "Database error" }
    }
}

export async function submitSignatures(signatureData: string, initialsData: string) {
    const session = await auth()
    if (!session?.user?.id) return { error: "Unauthorized" }

    const validate = signatureSchema.safeParse({ signatureData, initialsData })
    if (!validate.success) {
        return { error: "Invalid signature data" }
    }

    // Logger for payload size to diagnose potential limits
    const totalSizeKB = (signatureData.length + initialsData.length) / 1024
    console.log(`[ONBOARDING] Saving signatures for user ${session.user.id}. Total payload size: ${totalSizeKB.toFixed(2)} KB`);

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                signatureUrl: signatureData, // Storing base64 directly for MVP
                initialsUrl: initialsData,
                onboardingCompleted: true,
                onboardingStep: 3
            }
        })

        console.log(`[ONBOARDING] User ${session.user.id} marked as onboardingCompleted in DB`);
        revalidatePath("/onboarding")
        return { success: true }
    } catch (error) {
        console.error("[ONBOARDING] Error saving signatures to Prisma:", error)
        return { error: "Database error while saving signatures. The files might be too large or the connection was lost." }
    }
}
