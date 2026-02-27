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

export async function getAuditLogs(params: {
    page?: number
    limit?: number
    action?: string
    entity?: string
    userId?: string
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    const officeRole = String((session.user as any).officeRole).toUpperCase()

    // Must be QA or Office SUPER_ADMIN
    if (role !== "qa" && officeRole !== "SUPER_ADMIN") {
        return { error: "Forbidden: Only Super Admins can access audit logs." }
    }

    const { page = 1, limit = 50, action, entity, userId } = params
    const skip = (page - 1) * limit

    const where: any = {}
    if (action && action !== "ALL") where.action = action
    if (entity && entity !== "ALL") where.entity = entity
    if (userId && userId.trim() !== "") where.userId = userId

    try {
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where })
        ])

        return { success: true, logs, total }
    } catch (error) {
        console.error("Failed to fetch audit logs:", error)
        return { error: "Failed to fetch audit logs" }
    }
}
