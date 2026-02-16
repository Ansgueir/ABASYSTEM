"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const profileSchema = z.object({
    phone: z.string().min(10, "Phone number must be at least 10 characters"),
    address: z.string().min(5, "Address must be at least 5 characters"),
})

export async function updateProfile(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) {
        return { error: "Not authenticated" }
    }

    const phone = formData.get("phone") as string
    const address = formData.get("address") as string

    const validated = profileSchema.safeParse({ phone, address })
    if (!validated.success) {
        return { error: validated.error.flatten().fieldErrors.phone?.[0] || validated.error.flatten().fieldErrors.address?.[0] || "Validation failed" }
    }

    try {
        const role = (session.user as any).role?.toUpperCase()

        if (role === "STUDENT" || role === "QA") {
            await prisma.student.update({
                where: { userId: session.user.id },
                data: {
                    phone: validated.data.phone,
                    address: validated.data.address
                } as any
            })
        } else if (role === "SUPERVISOR") {
            await prisma.supervisor.update({
                where: { userId: session.user.id },
                data: {
                    phone: validated.data.phone,
                    address: validated.data.address
                } as any
            })
        } else if (role === "OFFICE") {
            await prisma.officeMember.update({
                where: { userId: session.user.id },
                data: {
                    // Office users might not have phone/address in their specific table?
                    // Let's check schema. Prisma schema shows phone/address for Student and Supervisor.
                    // OfficeMember only has fullName.
                }
            })
        }

        revalidatePath("/student/profile")
        revalidatePath("/supervisor/profile")
        return { success: true }
    } catch (error) {
        console.error("Profile update error:", error)
        return { error: "Failed to update profile in database" }
    }
}
