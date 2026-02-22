"use server"

import { z } from "zod"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ActivityType, SettingType, SupervisionFormat } from "@prisma/client"
import { startOfMonth, endOfMonth } from "date-fns"

const logHoursSchema = z.object({
    type: z.enum(["independent", "supervision"]),
    date: z.string().transform((str) => new Date(str)),
    startTime: z.string().min(1, "Start time is required"),
    minutes: z.preprocess((a) => parseInt(String(a), 10), z.number().min(1, "Duration must be at least 1 minute")),
    setting: z.nativeEnum(SettingType),
    activityType: z.nativeEnum(ActivityType),
    notes: z.string().optional(),
    supervisorId: z.string().optional(),
    studentId: z.string().optional(), // Added studentId
    supervisionFormat: z.nativeEnum(SupervisionFormat).optional(),
})

export type LogHoursState = {
    success?: boolean
    error?: string
    warning?: string
    fieldErrors?: Record<string, string[]>
}

async function validateMonthlyLimit(studentId: string, date: Date, newHours: number) {
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const independent = await prisma.independentHour.aggregate({
        where: {
            studentId,
            date: { gte: start, lte: end }
        },
        _sum: { hours: true }
    })

    const supervision = await prisma.supervisionHour.aggregate({
        where: {
            studentId,
            date: { gte: start, lte: end }
        },
        _sum: { hours: true }
    })

    const currentTotal = (Number(independent._sum.hours) || 0) + (Number(supervision._sum.hours) || 0)
    const total = currentTotal + newHours

    // Business Rule: 130h max normally, 160h in 2027
    const year = date.getFullYear()
    const limit = year === 2027 ? 160 : 130

    if (total > limit) {
        throw new Error(`Limit Exceeded: You have reached the monthly cap of ${limit} hours. (Current: ${currentTotal.toFixed(2)}h + New: ${newHours.toFixed(2)}h)`)
    }
}

// Check ratio of restricted hours
// BCBA: Restricted > 40% -> Alert
// BCaBA: Restricted > 60% -> Alert
// Note: This returns a warning message, not an error that blocks execution
async function checkRestrictedHoursRatio(studentId: string, date: Date, newHours: number, isRestricted: boolean, level: "BCBA" | "BCaBA"): Promise<string | null> {
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const independent = await prisma.independentHour.findMany({
        where: { studentId, date: { gte: start, lte: end } },
        select: { hours: true, activityType: true }
    })

    const supervision = await prisma.supervisionHour.findMany({
        where: { studentId, date: { gte: start, lte: end } },
        select: { hours: true, activityType: true }
    })

    let totalRestricted = 0
    let totalTotal = 0

    // Helper to sum
    const sum = (hours: number, type: ActivityType) => {
        totalTotal += hours
        if (type === ActivityType.RESTRICTED) {
            totalRestricted += hours
        }
    }

    independent.forEach(h => sum(Number(h.hours), h.activityType))
    supervision.forEach(h => sum(Number(h.hours), h.activityType))

    // Add current being logged
    totalTotal += newHours
    if (isRestricted) {
        totalRestricted += newHours
    }

    if (totalTotal === 0) return null

    const ratio = totalRestricted / totalTotal
    const percentage = ratio * 100

    console.log(`[Restricted Check] Level: ${level}, Restricted: ${totalRestricted}, Total: ${totalTotal}, %: ${percentage.toFixed(2)}`)

    if (level === "BCBA" && percentage > 40) {
        console.log("[Restricted Check] BCBA Limit Exceeded")
        return `Warning: Restricted hours are at ${percentage.toFixed(1)}% (Max 40% recommended for BCBA).`
    }
    if (level === "BCaBA" && percentage > 60) {
        console.log("[Restricted Check] BCaBA Limit Exceeded")
        return `Warning: Restricted hours are at ${percentage.toFixed(1)}% (Max 60% recommended for BCaBA).`
    }

    return null
}

export async function logHours(prevState: LogHoursState, formData: FormData) {
    const session = await auth()
    if (!session || !session.user) {
        return { error: "Unauthorized" }
    }

    const role = String((session.user as any).role).toLowerCase()

    console.log("LogHours: Session User", session.user)
    console.log("LogHours: Role found", role)

    if (role !== "student" && role !== "supervisor") {
        return { error: `Unauthorized role. Expected 'student' or 'supervisor', found '${role}'` }
    }

    const rawData = Object.fromEntries(formData.entries())
    const validatedFields = logHoursSchema.safeParse(rawData)

    if (!validatedFields.success) {
        const errors = validatedFields.error.flatten().fieldErrors;
        const errorMessage = Object.entries(errors)
            .map(([key, msgs]) => `${key}: ${msgs?.join(", ")}`)
            .join("; ");
        console.error("Validation failed:", errorMessage);
        return {
            error: "Validation failed: " + errorMessage,
            fieldErrors: errors,
        }
    }

    const data = validatedFields.data
    const hoursDecimal = data.minutes / 60

    try {
        let studentId = data.studentId
        let supervisorId = data.supervisorId

        if (role === "student") {
            const student = await prisma.student.findUnique({
                where: { userId: session.user.id }
            })
            if (!student) return { error: "Student profile not found" }
            studentId = student.id
            // If supervision, use assigned supervisor
            if (data.type === "supervision") {
                if (!student.supervisorId) return { error: "No supervisor assigned" }
                supervisorId = student.supervisorId
            }
        } else if (role === "supervisor") {
            // Supervisor logging for a student
            if (!studentId) return { error: "Student selection is required for supervisors" }

            // Verify supervisor context or assignment?
            // For now assume supervisor is logging AS the supervisor
            const supervisor = await prisma.supervisor.findUnique({
                where: { userId: session.user.id }
            })
            if (!supervisor) return { error: "Supervisor profile not found" }
            supervisorId = supervisor.id
        }

        if (!studentId) return { error: "Student ID missing" }

        // Validate 130h limit
        await validateMonthlyLimit(studentId, data.date, hoursDecimal)

        const [hours, mins] = data.startTime.split(':').map(Number)
        const startDateTime = new Date(data.date)
        startDateTime.setHours(hours, mins, 0, 0)

        if (data.type === "independent") {
            // Supervisors usually don't log independent hours FOR students, but if they do:
            await prisma.independentHour.create({
                data: {
                    studentId: studentId,
                    date: data.date,
                    startTime: startDateTime,
                    hours: hoursDecimal,
                    setting: data.setting,
                    activityType: data.activityType,
                    notes: data.notes,
                }
            })
        } else {
            if (!supervisorId) return { error: "Supervisor ID missing for supervision hour" }

            await prisma.supervisionHour.create({
                data: {
                    studentId: studentId,
                    supervisorId: supervisorId,
                    date: data.date,
                    startTime: startDateTime,
                    hours: hoursDecimal,
                    setting: data.setting,
                    activityType: data.activityType,
                    supervisionType: data.supervisionFormat || SupervisionFormat.INDIVIDUAL,
                    notes: data.notes,
                }
            })
        }

        // Check for Restricted Ratio Warnings
        let warning: string | undefined = undefined
        const studentProfile = await prisma.student.findUnique({ where: { id: studentId } })
        if (studentProfile) {
            const warningMsg = await checkRestrictedHoursRatio(
                studentId,
                data.date,
                hoursDecimal,
                data.activityType === ActivityType.RESTRICTED,
                studentProfile.level as "BCBA" | "BCaBA" // Cast based on schema enum, assuming values match strings
            )
            if (warningMsg) warning = warningMsg
        }

        revalidatePath("/student")
        revalidatePath("/supervisor")
        console.log("RETURNING FROM ACTION:", { success: true, warning: warning || null })
        return { success: true, warning: warning || null }

    } catch (err) {
        console.error("Failed to log hours:", err)
        if (err instanceof Error) {
            return { error: err.message }
        }
        return { error: "Database error occurred." }
    }
}

export async function approveSupervisionHour(logId: string) {
    const session = await auth()
    const role = String((session?.user as any)?.role).toLowerCase()

    if (role !== "office" && role !== "qa") {
        return { error: "Unauthorized" }
    }

    try {
        const hour = await prisma.supervisionHour.findUnique({
            where: { id: logId },
            include: { student: { include: { supervisor: true } } }
        })

        if (!hour) return { error: "Hour log not found" }

        const hourlyRate = Number(hour.student.hourlyRate || 0)
        let percent = 0.54
        if (hour.student.supervisor?.paymentPercentage) {
            percent = Number(hour.student.supervisor.paymentPercentage)
        }

        const amountBilled = Number(hour.hours) * hourlyRate
        const supervisorPay = amountBilled * percent

        await prisma.supervisionHour.update({
            where: { id: logId },
            data: {
                status: "APPROVED",
                amountBilled,
                supervisorPay
            }
        })

        if (hour.student.supervisorId) {
            const today = new Date()
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
            const existingPayment = await prisma.supervisorPayment.findFirst({
                where: {
                    supervisorId: hour.student.supervisorId,
                    studentId: hour.student.id,
                    monthYear: firstDayOfMonth
                }
            })

            if (existingPayment) {
                await prisma.supervisorPayment.update({
                    where: { id: existingPayment.id },
                    data: {
                        amountDue: { increment: supervisorPay },
                        balanceDue: { increment: supervisorPay }
                    }
                })
            } else {
                await prisma.supervisorPayment.create({
                    data: {
                        supervisorId: hour.student.supervisorId,
                        studentId: hour.student.id,
                        monthYear: firstDayOfMonth,
                        amountDue: supervisorPay,
                        balanceDue: supervisorPay,
                        amountPaidThisMonth: 0,
                        amountAlreadyPaid: 0
                    }
                })
            }
        }

        revalidatePath("/office/supervision-logs")
        revalidatePath("/supervisor/payments")
        return { success: true }
    } catch (error) {
        console.error("Failed to approve log:", error)
        return { error: "Failed to approve log" }
    }
}

export async function rejectSupervisionHour(logId: string, reason: string) {
    const session = await auth()
    const role = String((session?.user as any)?.role).toLowerCase()

    if (role !== "office" && role !== "qa") {
        return { error: "Unauthorized" }
    }

    try {
        await prisma.supervisionHour.update({
            where: { id: logId },
            data: {
                status: "REJECTED",
                rejectReason: reason
            }
        })
        revalidatePath("/office/supervision-logs")
        return { success: true }
    } catch (error) {
        console.error("Failed to reject log:", error)
        return { error: "Failed to reject log" }
    }
}
