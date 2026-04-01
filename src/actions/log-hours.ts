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

    // Load general values
    const settings = await prisma.generalValues.findFirst()
    const globalLimit = (settings as any)?.maxHoursPerMonth || 130
    
    // Load student to see if they have a specific limit overridden, though general values config should prevail if user requested it. 
    // Fallback to year logic if neither is set specific.
    const year = date.getFullYear()
    const limit = globalLimit

    if (total > limit) {
        throw new Error(`Limit Exceeded: You have reached the monthly cap of ${limit} hours. (Current: ${currentTotal.toFixed(2)}h + New: ${newHours.toFixed(2)}h)`)
    }
}

async function validateTimeOverlap(studentId: string, date: Date, newStart: Date, minutes: number) {
    const newEnd = new Date(newStart.getTime() + minutes * 60000)
    console.log(`[OverlapCheck] New: ${newStart.toISOString()} - ${newEnd.toISOString()} for Student: ${studentId}`)

    // Fetch all records for the student within surrounding hours (+/- 12h)
    const checkStart = new Date(newStart.getTime() - 12 * 3600000)
    const checkEnd = new Date(newStart.getTime() + 12 * 3600000)

    // 1. Check Independent Hours
    const existingIndep = await prisma.independentHour.findMany({
        where: {
            studentId,
            startTime: {
                gte: checkStart,
                lte: checkEnd
            }
        }
    })

    console.log(`[OverlapCheck] Found ${existingIndep.length} existing Independent records within 24h window.`)

    for (const h of existingIndep) {
        const start = new Date(h.startTime)
        const hours = Number(h.hours)
        const end = new Date(start.getTime() + hours * 3600000)
        
        console.log(`[OverlapCheck] Checking vs ID ${h.id.substring(0,8)} | Existing: ${start.toISOString()} - ${end.toISOString()}`)
        
        if (newStart < end && newEnd > start) {
            console.log(`[OverlapCheck] CONFLICT DETECTED with ID ${h.id}`)
            throw new Error(`Time conflict: You already have an activity logged from ${formatTime(start)} to ${formatTime(end)}`)
        }
    }

    // 2. Check Supervision Hours
    const existingSup = await prisma.supervisionHour.findMany({
        where: {
            studentId,
            startTime: {
                gte: checkStart,
                lte: checkEnd
            }
        }
    })

    console.log(`[OverlapCheck] Found ${existingSup.length} existing Supervision records within 24h window.`)

    for (const h of existingSup) {
        const start = new Date(h.startTime)
        const hours = Number(h.hours)
        const end = new Date(start.getTime() + hours * 3600000)
        
        console.log(`[OverlapCheck] Checking vs ID ${h.id.substring(0,8)} | Existing: ${start.toISOString()} - ${end.toISOString()}`)

        if (newStart < end && newEnd > start) {
            console.log(`[OverlapCheck] CONFLICT DETECTED with ID ${h.id}`)
            throw new Error(`Time conflict: You already have an activity logged from ${formatTime(start)} to ${formatTime(end)}`)
        }
    }
}

function formatTime(date: Date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
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
                where: { userId: session.user.id },
                include: { supervisors: true }
            })
            if (!student) return { error: "Student profile not found" }
            
            // BUSINESS RULE: Student MUST have at least one supervisor to log ANY hour.
            if (!student.supervisors || student.supervisors.length === 0) {
                return { error: "Forbidden: You cannot log hours yet. Please contact the Office to have a Supervisor assigned to your profile." }
            }

            studentId = student.id
            // If supervision, use assigned supervisor
            if (data.type === "supervision") {
                if (!student.supervisorId) return { error: "No primary supervisor assigned for supervision logging" }
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

        // Validate time overlap
        await validateTimeOverlap(studentId, data.date, startDateTime, data.minutes)

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
        const hour = await prisma.supervisionHour.findUnique({
            where: { id: logId }
        })

        if (!hour) return { error: "Log not found" }
        if (hour.status === "BILLED") return { error: "Cannot reject a log that has already been billed." }

        // If reversing an APPROVED log, deduct the pay from the payment card
        if (hour.status === "APPROVED" && hour.supervisorPay) {
            const today = new Date(hour.date) // Use the hour's date to find the month card
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

            const existingPayment = await prisma.supervisorPayment.findFirst({
                where: {
                    studentId: hour.studentId,
                    monthYear: firstDayOfMonth
                }
            })

            if (existingPayment) {
                await prisma.supervisorPayment.update({
                    where: { id: existingPayment.id },
                    data: {
                        amountDue: { decrement: hour.supervisorPay },
                        balanceDue: { decrement: hour.supervisorPay }
                    }
                })
            }
        }

        await prisma.supervisionHour.update({
            where: { id: logId },
            data: {
                status: "REJECTED",
                rejectReason: reason,
                amountBilled: 0,
                supervisorPay: 0
            }
        })
        revalidatePath("/office/supervision-logs")
        return { success: true }
    } catch (error) {
        console.error("Failed to reject log:", error)
        return { error: "Failed to reject log" }
    }
}

export async function revertSupervisionHourToPending(logId: string) {
    const session = await auth()
    const role = String((session?.user as any)?.role).toLowerCase()
    const officeRole = String((session?.user as any)?.officeRole).toUpperCase()

    if ((role !== "office" && role !== "qa") || officeRole !== "SUPER_ADMIN") {
        return { error: "Forbidden: Only Super Admins can revert logs." }
    }

    try {
        const hour = await prisma.supervisionHour.findUnique({
            where: { id: logId }
        })

        if (!hour) return { error: "Log not found" }
        if (hour.status !== "REJECTED") return { error: "Only rejected logs can be reverted." }

        await prisma.supervisionHour.update({
            where: { id: logId },
            data: {
                status: "PENDING",
                rejectReason: null
            }
        })
        revalidatePath("/office/supervision-logs")
        return { success: true }
    } catch (error) {
        console.error("Failed to revert log:", error)
        return { error: "Failed to revert log" }
    }
}

// ─── BULK HOUR GENERATION ───────────────────────────────────────────────────

export type BulkLogState = {
    success?: boolean
    created?: number
    skipped?: number
    error?: string
}

export async function logBulkHours(payload: {
    type: 'independent' | 'supervision'
    startDate: string
    endDate: string
    weekdays: number[]   // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    startTime: string    // "HH:MM"
    minutes: number
    setting: string
    activityType: string
    notes?: string
    studentId?: string   // for supervisor-initiated logs
}): Promise<BulkLogState> {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== 'student' && role !== 'supervisor') {
        return { error: 'Unauthorized role' }
    }

    try {
        let studentId = payload.studentId
        let supervisorId: string | undefined

        if (role === 'student') {
            const student = await prisma.student.findUnique({
                where: { userId: session.user.id },
                include: { supervisors: true }
            })
            if (!student) return { error: 'Student profile not found' }
            if (!student.supervisors || student.supervisors.length === 0) {
                return { error: 'Forbidden: You need an assigned Supervisor before logging hours.' }
            }
            studentId = student.id
            if (payload.type === 'supervision') {
                if (!student.supervisorId) return { error: 'No primary supervisor assigned for supervision logging' }
                supervisorId = student.supervisorId
            }
        } else if (role === 'supervisor') {
            if (!studentId) return { error: 'Student ID is required for supervisor bulk logging' }
            const supervisor = await prisma.supervisor.findUnique({ where: { userId: session.user.id } })
            if (!supervisor) return { error: 'Supervisor profile not found' }
            supervisorId = supervisor.id
        }

        if (!studentId) return { error: 'Could not resolve Student ID' }

        const hoursDecimal = payload.minutes / 60
        const start = new Date(payload.startDate)
        const end = new Date(payload.endDate)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)

        if (start > end) return { error: 'Start Date must be before End Date' }

        // Build list of matching dates
        const matchingDates: Date[] = []
        const cursor = new Date(start)
        cursor.setHours(0, 0, 0, 0)

        while (cursor <= end) {
            if (payload.weekdays.includes(cursor.getDay())) {
                matchingDates.push(new Date(cursor))
            }
            cursor.setDate(cursor.getDate() + 1)
        }

        if (matchingDates.length === 0) {
            return { error: 'No matching dates found for the selected weekdays and date range.' }
        }

        // Validate monthly cap for each unique month affected
        const uniqueMonths = new Set(matchingDates.map(d => `${d.getFullYear()}-${d.getMonth()}`))
        for (const monthKey of uniqueMonths) {
            const [year, month] = monthKey.split('-').map(Number)
            const monthDate = new Date(year, month, 15)
            const matchingInThisMonth = matchingDates.filter(d => d.getFullYear() === year && d.getMonth() === month)
            const newHoursInMonth = matchingInThisMonth.length * hoursDecimal
            await validateMonthlyLimit(studentId, monthDate, newHoursInMonth)
        }

        let created = 0
        let skipped = 0

        for (const date of matchingDates) {
            const [h, m] = payload.startTime.split(':').map(Number)
            const startDateTime = new Date(date)
            startDateTime.setHours(h, m, 0, 0)

            try {
                if (payload.type === 'independent') {
                    await prisma.independentHour.create({
                        data: {
                            studentId: studentId!,
                            date,
                            startTime: startDateTime,
                            hours: hoursDecimal,
                            setting: payload.setting as any,
                            activityType: payload.activityType as any,
                            notes: payload.notes,
                        }
                    })
                } else {
                    if (!supervisorId) { skipped++; continue }
                    await prisma.supervisionHour.create({
                        data: {
                            studentId: studentId!,
                            supervisorId,
                            date,
                            startTime: startDateTime,
                            hours: hoursDecimal,
                            setting: payload.setting as any,
                            activityType: payload.activityType as any,
                            supervisionType: 'INDIVIDUAL' as any,
                            notes: payload.notes,
                        }
                    })
                }
                created++
            } catch {
                skipped++
            }
        }

        revalidatePath('/student')
        revalidatePath('/student/timesheet')
        revalidatePath('/supervisor')
        revalidatePath('/supervisor/timesheet')

        return { success: true, created, skipped }

    } catch (err) {
        console.error('Bulk log error:', err)
        return { error: err instanceof Error ? err.message : 'Unexpected error during bulk log' }
    }
}

// ─── STUDENT EDIT GUARD ──────────────────────────────────────────────────────

export async function updateIndependentHour(
    logId: string,
    data: {
        setting?: string
        activityType?: string
        notes?: string
        minutes?: number
        date?: string       // YYYY-MM-DD
        startTime?: string  // HH:MM
        type?: 'independent' | 'supervision'
    }
): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== 'student' && role !== 'supervisor' && role !== 'qa') {
        return { error: 'Forbidden: You do not have permission to edit logs.' }
    }

    try {
        const hour = await prisma.independentHour.findUnique({ where: { id: logId } })
        if (!hour) return { error: 'Log not found' }

        // 403 Guard — APPROVED logs are immutable
        if (hour.status === 'APPROVED') {
            return { error: 'Forbidden: This log has already been approved and cannot be modified.' }
        }

        // ── Resolve final date & startTime ──────────────────────────────────
        let finalDate = hour.date
        let finalStartTime = hour.startTime

        if (data.date) {
            const newDate = new Date(data.date)
            if (!isNaN(newDate.getTime())) {
                finalDate = newDate
                if (data.startTime) {
                    const [h, m] = data.startTime.split(':').map(Number)
                    const newStart = new Date(newDate)
                    newStart.setHours(h, m, 0, 0)
                    finalStartTime = newStart
                }
            }
        } else if (data.startTime) {
            const [h, m] = data.startTime.split(':').map(Number)
            const base = new Date(hour.date)
            base.setHours(h, m, 0, 0)
            finalStartTime = base
        }

        const finalHours = data.minutes !== undefined ? data.minutes / 60 : Number(hour.hours)
        const finalSetting = (data.setting ?? hour.setting) as any
        const finalActivity = (data.activityType ?? hour.activityType) as any
        const finalNotes = data.notes !== undefined ? data.notes : hour.notes

        // ── Type change: independent → supervision ──────────────────────────
        if (data.type === 'supervision') {
            // Find student to get supervisorId
            const student = await prisma.student.findUnique({
                where: { id: hour.studentId },
                select: { supervisorId: true }
            })
            if (!student?.supervisorId) {
                return { error: 'Cannot convert: no primary supervisor is assigned to this student.' }
            }

            // Atomic migration: create supervised + delete independent
            await prisma.$transaction([
                prisma.supervisionHour.create({
                    data: {
                        studentId: hour.studentId,
                        supervisorId: student.supervisorId,
                        date: finalDate,
                        startTime: finalStartTime,
                        hours: finalHours,
                        setting: finalSetting,
                        activityType: finalActivity,
                        supervisionType: 'INDIVIDUAL' as any,
                        notes: finalNotes,
                    }
                }),
                prisma.independentHour.delete({ where: { id: logId } })
            ])

            revalidatePath('/student/timesheet')
            return { success: true }
        }

        // ── Same type: update in place ───────────────────────────────────────
        const updatePayload: any = {
            date: finalDate,
            startTime: finalStartTime,
            hours: finalHours,
            setting: finalSetting,
            activityType: finalActivity,
            notes: finalNotes,
        }

        await prisma.independentHour.update({ where: { id: logId }, data: updatePayload })

        revalidatePath('/student/timesheet')
        return { success: true }
    } catch (err) {
        console.error('updateIndependentHour error:', err)
        return { error: err instanceof Error ? err.message : 'Failed to update log' }
    }
}

export async function updateSupervisionHour(
    logId: string,
    data: {
        notes?: string
        setting?: string
        activityType?: string
        minutes?: number
        date?: string
        startTime?: string
        supervisionType?: string
    }
): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== 'supervisor' && role !== 'qa') return { error: 'Forbidden: Only supervisors can edit supervision logs.' }

    try {
        const hour = await prisma.supervisionHour.findUnique({ where: { id: logId } })
        if (!hour) return { error: 'Log not found' }

        // 403 Guard — APPROVED or BILLED logs are immutable
        if (hour.status === 'APPROVED' || hour.status === 'BILLED') {
            return { error: 'Forbidden: This log has already been approved/billed and cannot be modified.' }
        }

        // ── Resolve final date & startTime ──────────────────────────────────
        let finalDate = hour.date
        let finalStartTime = hour.startTime

        if (data.date) {
            const newDate = new Date(data.date)
            if (!isNaN(newDate.getTime())) {
                finalDate = newDate
                if (data.startTime) {
                    const [h, m] = data.startTime.split(':').map(Number)
                    const newStart = new Date(newDate)
                    newStart.setHours(h, m, 0, 0)
                    finalStartTime = newStart
                }
            }
        } else if (data.startTime) {
            const [h, m] = data.startTime.split(':').map(Number)
            const base = new Date(hour.date)
            base.setHours(h, m, 0, 0)
            finalStartTime = base
        }

        const finalHours = data.minutes !== undefined ? data.minutes / 60 : Number(hour.hours)
        const finalSetting = (data.setting ?? hour.setting) as any
        const finalActivity = (data.activityType ?? hour.activityType) as any
        const finalSupervisionType = (data.supervisionType ?? hour.supervisionType) as any
        const finalNotes = data.notes !== undefined ? data.notes : hour.notes

        const updatePayload: any = {
            date: finalDate,
            startTime: finalStartTime,
            hours: finalHours,
            setting: finalSetting,
            activityType: finalActivity,
            supervisionType: finalSupervisionType,
            notes: finalNotes,
        }

        await prisma.supervisionHour.update({ where: { id: logId }, data: updatePayload })

        revalidatePath('/supervisor/timesheet')
        return { success: true }
    } catch (err) {
        console.error('updateSupervisionHour error:', err)
        return { error: err instanceof Error ? err.message : 'Failed to update log' }
    }
}

