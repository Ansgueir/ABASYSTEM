"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

export async function changeInitialPassword(prevState: any, formData: FormData) {
    const session = await auth()
    if (!session || !session.user) {
        return { error: "Unauthorized" }
    }

    const rawData = Object.fromEntries(formData.entries())
    const validatedFields = changePasswordSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return {
            error: "Validation error",
            fieldErrors: validatedFields.error.flatten().fieldErrors,
        }
    }

    const { currentPassword, newPassword } = validatedFields.data

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        })

        if (!user || !user.passwordHash) {
            return { error: "User not found" }
        }

        // Verify current password
        const passwordsMatch = await bcrypt.compare(currentPassword, user.passwordHash)
        if (!passwordsMatch) {
            return { error: "Incorrect current password" }
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update user: set new password and isFirstLogin = false
        // Also set onboardingStep = 1 to start the wizard
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
                isFirstLogin: false,
                onboardingStep: 1,
                onboardingCompleted: false
            }
        })

        console.log(`Password changed for user ${user.email}. Starting onboarding.`)

        // Return success so client can redirect or refresh
        return { success: true }

    } catch (error) {
        console.error("Failed to change password:", error)
        return { error: "Failed to update password" }
    }
}
