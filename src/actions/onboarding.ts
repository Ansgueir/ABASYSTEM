"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const contactSchema = z.object({
    phone: z.string().min(10, "Phone number must be valid"),
    address: z.string().min(5, "Address must be valid")
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
        address: formData.get("address") as string
    }

    const validate = contactSchema.safeParse(rawData)
    if (!validate.success) {
        return { error: "Validation failed", fieldErrors: validate.error.flatten().fieldErrors }
    }

    try {
        const userRole = (session.user as any).role?.toUpperCase()
        if (userRole === "STUDENT") {
            await prisma.student.update({
                where: { userId: session.user.id },
                data: {
                    phone: validate.data.phone,
                    address: validate.data.address
                }
            })
        } else if (userRole === "SUPERVISOR") {
            await prisma.supervisor.update({
                where: { userId: session.user.id },
                data: {
                    phone: validate.data.phone,
                    address: validate.data.address
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

    try {
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                signatureUrl: signatureData, // Storing base64 directly for MVP
                initialsUrl: initialsData,
                onboardingCompleted: true,
                onboardingStep: 3 // Stay at 3 or increment? Requirement says "onboardingCompleted = true".
            }
        })

        revalidatePath("/onboarding")
        return { success: true }
    } catch (error) {
        console.error("Error saving signatures:", error)
        return { error: "Failed to save signatures" }
    }
}
