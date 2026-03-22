"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"

const changePasswordSchema = z.object({
    // Explicitly permissive for currentPassword to allow any temporary password format
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string()
        .min(8, "Password must be at least 8 characters")
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

        // Return success so client can redirect or refresh
        return { success: true }
    } catch (error) {
        console.error("Failed to change password:", error)
        return { error: "Failed to update password" }
    }
}

// ─── SELF-SERVICE PASSWORD RESET (Login Page) ────────────────────────────────
// Generates a secure temp password, stores it hashed, flags isFirstLogin=true,
// sends email. Does NOT reveal whether the email exists (anti-enumeration).

function generateTempPassword(): string {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    const lower = "abcdefghjkmnpqrstuvwxyz"
    const digits = "23456789"
    const specials = "!@#$%&*"
    const all = upper + lower + digits + specials

    const getRandom = (charset: string) => charset[Math.floor(Math.random() * charset.length)]

    // Guarantee at least one of each required type
    const mandatory = [
        getRandom(upper),
        getRandom(upper),
        getRandom(lower),
        getRandom(lower),
        getRandom(digits),
        getRandom(digits),
        getRandom(specials),
    ]

    // Fill to 12 chars
    const extra = Array.from({ length: 5 }, () => getRandom(all))
    const password = [...mandatory, ...extra]
        .sort(() => Math.random() - 0.5)
        .join('')

    return password
}

export async function requestPasswordReset(email: string): Promise<{ success?: boolean; error?: string }> {
    // Sanitize input
    const cleanEmail = (email || "").trim().toLowerCase()
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { error: "Invalid email address" }
    }

    try {
        const user = await prisma.user.findUnique({ where: { email: cleanEmail } })

        // Anti-enumeration: always return success even if user not found
        if (!user || !user.isActive) {
            console.log(`[PasswordReset] Email not found or inactive: ${cleanEmail}`)
            return { success: true }
        }

        const tempPassword = generateTempPassword()
        const hashedTemp = await bcrypt.hash(tempPassword, 10)

        // Flag as first login so middleware forces /change-password on next sign-in
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: hashedTemp,
                isFirstLogin: true,
            }
        })

        const settings = await prisma.generalValues.findFirst()
        const companyName = settings?.companyName || "ABA Supervision System"
        const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

        await sendEmail({
            to: cleanEmail,
            subject: `${companyName} – Password Reset`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background:#f9f9f9; padding: 32px; border-radius: 12px;">
                    <div style="text-align:center; margin-bottom:24px;">
                        <div style="display:inline-block; background: linear-gradient(135deg,#6366f1,#8b5cf6); padding:16px; border-radius:12px;">
                            <span style="font-size:32px;">🔑</span>
                        </div>
                    </div>
                    <h2 style="color:#1e1b4b; text-align:center; margin:0 0 8px;">Password Reset</h2>
                    <p style="color:#6b7280; text-align:center; margin:0 0 24px;">Your temporary access credentials are below.</p>

                    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px;">
                        <p style="margin:0 0 8px; color:#374151;"><strong>Email:</strong> ${cleanEmail}</p>
                        <p style="margin:0; color:#374151;"><strong>Temporary Password:</strong>
                          <span style="font-family:monospace; background:#f3f4f6; padding:2px 8px; border-radius:4px; font-size:16px;">${tempPassword}</span>
                        </p>
                    </div>

                    <p style="color:#6b7280; font-size:14px;">For security reasons, you will be asked to set a new password immediately after signing in.</p>

                    <div style="text-align:center; margin-top:24px;">
                        <a href="${appUrl}/login"
                           style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:15px;">
                            Sign In Now
                        </a>
                    </div>

                    <p style="color:#9ca3af; font-size:12px; text-align:center; margin-top:24px;">
                        If you did not request this reset, please contact your administrator immediately.
                    </p>
                </div>
            `
        })

        console.log(`[PasswordReset] Temp password sent to: ${cleanEmail}`)
        return { success: true }

    } catch (err) {
        console.error("[PasswordReset] Error:", err)
        return { error: "Could not process request. Please try again later." }
    }
}

// ─── SUPER OFFICE: Reset password for any user (email-based only) ────────────
// Only qa-super@abasystem.com can override with a manual password.

export async function adminResetUserPassword(
    targetUserId: string,
    manualPassword?: string  // Only accepted if caller is qa-super@abasystem.com
): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const callerEmail = (session.user as any).email as string
    const callerRole = String((session.user as any).role).toUpperCase()

    // Must be SUPER_ADMIN or SUPER_OFFICE
    if (callerRole !== "SUPER_ADMIN" && callerRole !== "SUPER_OFFICE") {
        return { error: "Forbidden" }
    }

    // Manual password: ONLY qa-super@abasystem.com
    const isQaSuperUser = callerEmail === "qa-super@abasystem.com"
    if (manualPassword && !isQaSuperUser) {
        return { error: "Forbidden: Manual password entry is restricted to the system administrator." }
    }

    try {
        const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
        if (!targetUser || !targetUser.isActive) return { error: "User not found" }

        let passwordToSet: string
        let sendNotification = true

        if (manualPassword && isQaSuperUser) {
            // qa-super explicit manual override — no email notification needed
            passwordToSet = manualPassword
            sendNotification = false
        } else {
            // Standard flow: generate temp password and send email
            passwordToSet = generateTempPassword()
        }

        const hashedPassword = await bcrypt.hash(passwordToSet, 10)

        await prisma.user.update({
            where: { id: targetUserId },
            data: {
                passwordHash: hashedPassword,
                isFirstLogin: true,
            }
        })

        if (sendNotification) {
            const settings = await prisma.generalValues.findFirst()
            const companyName = settings?.companyName || "ABA Supervision System"
            const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

            await sendEmail({
                to: targetUser.email,
                subject: `${companyName} – Your password has been reset`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background:#f9f9f9; padding: 32px; border-radius: 12px;">
                        <h2 style="color:#1e1b4b; text-align:center;">Password Reset</h2>
                        <p style="color:#6b7280; text-align:center;">An administrator has reset your password.</p>
                        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin:24px 0;">
                            <p style="margin:0 0 8px; color:#374151;"><strong>Email:</strong> ${targetUser.email}</p>
                            <p style="margin:0; color:#374151;"><strong>Temporary Password:</strong>
                              <span style="font-family:monospace; background:#f3f4f6; padding:2px 8px; border-radius:4px; font-size:16px;">${passwordToSet}</span>
                            </p>
                        </div>
                        <p style="color:#6b7280; font-size:14px;">You will be required to change this password upon your next login.</p>
                        <div style="text-align:center; margin-top:24px;">
                            <a href="${appUrl}/login"
                               style="display:inline-block; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:white; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:bold;">
                                Sign In
                            </a>
                        </div>
                    </div>
                `
            })
        }

        return { success: true }
    } catch (err) {
        console.error("[adminResetUserPassword] Error:", err)
        return { error: "Failed to reset password" }
    }
}

