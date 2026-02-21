"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateHourStatusSchema = z.object({
    id: z.string(),
    type: z.enum(["INDEPENDENT", "SUPERVISION"]),
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectReason: z.string().optional()
})

export async function updateHourStatus(formData: FormData) {
    const session = await auth()
    if (!session || !session.user) {
        return { error: "Unauthorized" }
    }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") {
        return { error: "Unauthorized role" }
    }

    const rawData = Object.fromEntries(formData.entries())
    const validatedFields = updateHourStatusSchema.safeParse(rawData)

    if (!validatedFields.success) {
        return { error: "Invalid data provided" }
    }

    const { id, type, status, rejectReason } = validatedFields.data

    try {
        if (type === "INDEPENDENT") {
            await prisma.independentHour.update({
                where: { id },
                data: { status, rejectReason: status === "REJECTED" ? rejectReason : null }
            })
        } else {
            await prisma.supervisionHour.update({
                where: { id },
                data: { status, rejectReason: status === "REJECTED" ? rejectReason : null }
            })
        }

        revalidatePath("/supervisor/students/[studentId]", "page")
        return { success: true }
    } catch (err) {
        console.error("Failed to update hour status:", err)
        return { error: "Database error occurred." }
    }
}
