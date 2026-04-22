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
    customSetting: z.string().optional(),
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

import { validatePlanLimits, validatePlanLimitsBulk } from "./plan-limits-helper"

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

        await validatePlanLimits(studentId, data.date, hoursDecimal, data.type as 'independent' | 'supervision', undefined, data.supervisionFormat as 'INDIVIDUAL' | 'GROUP')

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
                    customSetting: data.customSetting,
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
                    customSetting: data.customSetting,
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
        return await prisma.$transaction(async (tx) => {
            let hour = await tx.supervisionHour.findUnique({
                where: { id: logId },
                include: { student: { include: { supervisor: true } } }
            })

            // FALLBACK: If not found in SupervisionHour, it might be a Group Attendance entry
            // that hasn't been "mirrored" to a SupervisionHour yet (Fallback logic from Review Page)
            if (!hour) {
                const attendance = await tx.groupSupervisionAttendance.findUnique({
                    where: { id: logId },
                    include: { student: { include: { supervisor: true } }, session: true }
                })

                if (!attendance) return { error: "Hour log not found (Checked Supervision and Attendance)" }

                // Create the missing mirroring hour record correctly
                // We'll use the ID of the attendance as a reference to avoid duplicates if re-clicked
                // Wait! We can't use the same ID if they are different models in standard prisma, 
                // but we can check if one already exists for this session/student combo
                const existing = await tx.supervisionHour.findFirst({
                    where: { 
                        studentId: attendance.studentId,
                        groupSessionId: attendance.sessionId 
                    },
                    include: { student: { include: { supervisor: true } } }
                })

                if (existing) {
                    hour = existing
                } else {
                    // Create it on the fly
                    hour = await tx.supervisionHour.create({
                        data: {
                            studentId: attendance.studentId,
                            supervisorId: attendance.session.supervisorId,
                            date: attendance.session.date,
                            startTime: attendance.session.startTime,
                            hours: 1.0, // Default for groups
                            supervisionType: 'GROUP',
                            setting: 'OFFICE_CLINIC',
                            activityType: 'RESTRICTED',
                            notes: `Auto-generated from Group Attendance: ${attendance.session.topic}`,
                            groupTopic: attendance.session.topic,
                            groupSessionId: attendance.sessionId,
                            status: 'PENDING'
                        },
                        include: { student: { include: { supervisor: true } } }
                    })
                }
            }

            if (!hour) return { error: "Failed to resolve hour record" }

            // Guard: already approved AND properly linked → skip
            // If APPROVED but invoiceId is null = orphaned state, allow re-processing
            if (hour.status === "APPROVED" && hour.invoiceId !== null) {
                return { error: "Log already approved" }
            }

            const hourlyRate = Number(hour.student.hourlyRate || 0)
            let percent = 0.54
            if (hour.student.supervisor?.paymentPercentage) {
                percent = Number(hour.student.supervisor.paymentPercentage)
            }

            const amountBilled = Number(hour.hours) * hourlyRate

            // GROUP hours: office income only, supervisor earns $0
            const isGroupHour = hour.supervisionType === 'GROUP'
            const supervisorPay = isGroupHour ? 0 : amountBilled * percent

            // 1. Check if there's an existing READY_TO_GO invoice for this student
            let invoice = await tx.invoice.findFirst({
                where: {
                    studentId: hour.studentId,
                    status: "READY_TO_GO" as any
                }
            })

            if (!invoice) {
                // Create a new one if it doesn't exist
                invoice = await tx.invoice.create({
                    data: {
                        studentId: hour.studentId,
                        invoiceDate: new Date(),
                        amountDue: 0,
                        amountPaid: 0,
                        status: "READY_TO_GO" as any
                    }
                })
            }

            // 2. Update the log status and link to the invoice
            await tx.supervisionHour.update({
                where: { id: hour.id },
                data: {
                    status: "APPROVED",
                    amountBilled,
                    supervisorPay,
                    invoiceId: invoice.id
                }
            })

            // 3. Update invoice total
            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountDue: { increment: amountBilled }
                }
            })

            // --- Supervisor Payment Card (legacy) — ONLY for INDIVIDUAL hours ---
            if (!isGroupHour && hour.student.supervisorId) {
                const today = new Date()
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
                const existingPayment = await tx.supervisorPayment.findFirst({
                    where: {
                        supervisorId: hour.student.supervisorId,
                        studentId: hour.student.id,
                        monthYear: firstDayOfMonth
                    }
                })

                if (existingPayment) {
                    await tx.supervisorPayment.update({
                        where: { id: existingPayment.id },
                        data: {
                            amountDue: { increment: supervisorPay },
                            balanceDue: { increment: supervisorPay }
                        }
                    })
                } else {
                    await tx.supervisorPayment.create({
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
            revalidatePath("/office/payments")
            revalidatePath("/supervisor/payments")
            return { success: true }
        })
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
        return await prisma.$transaction(async (tx) => {
            let hour = await tx.supervisionHour.findUnique({
                where: { id: logId }
            })

            if (!hour) {
                // Check if it's an attendance record
                const attendance = await tx.groupSupervisionAttendance.findUnique({
                    where: { id: logId },
                    include: { session: true }
                })
                
                if (attendance) {
                    // Create and immediately reject
                    hour = await tx.supervisionHour.create({
                        data: {
                            studentId: attendance.studentId,
                            supervisorId: attendance.session.supervisorId,
                            date: attendance.session.date,
                            startTime: attendance.session.startTime,
                            hours: 1.0,
                            supervisionType: 'GROUP',
                            setting: 'OFFICE_CLINIC',
                            activityType: 'RESTRICTED',
                            status: 'PENDING',
                            groupSessionId: attendance.sessionId
                        }
                    })
                }
            }

            if (!hour) return { error: "Log not found" }
            if (hour.status === "BILLED") return { error: "Cannot reject a log that has already been billed." }

            // 1. If reversing an APPROVED log, deduct the pay from the payment card
            if (hour.status === "APPROVED" && hour.supervisorPay) {
                const today = new Date(hour.date)
                const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

                const existingPayment = await tx.supervisorPayment.findFirst({
                    where: {
                        studentId: hour.studentId,
                        monthYear: firstDayOfMonth
                    }
                })

                if (existingPayment) {
                    await tx.supervisorPayment.update({
                        where: { id: existingPayment.id },
                        data: {
                            amountDue: { decrement: hour.supervisorPay },
                            balanceDue: { decrement: hour.supervisorPay }
                        }
                    })
                }

                // 2. Unlink from Invoice and decrement Invoice total (unless already PAID)
                if (hour.invoiceId) {
                    const invoice = await tx.invoice.findUnique({
                        where: { id: hour.invoiceId }
                    })

                    if (invoice && invoice.status !== ("PAID" as any)) {
                        await tx.invoice.update({
                            where: { id: invoice.id },
                            data: {
                                amountDue: { decrement: hour.amountBilled || 0 }
                            }
                        })
                    }
                }
            }

            await tx.supervisionHour.update({
                where: { id: hour.id },
                data: {
                    status: "REJECTED",
                    rejectReason: reason,
                    amountBilled: 0,
                    supervisorPay: 0,
                    invoiceId: null // Clear linkage
                }
            })

            revalidatePath("/office/supervision-logs")
            revalidatePath("/office/payments")
            return { success: true }
        })
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
    customSetting?: string
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

        // 3. Collective Plan Validation (Robust)
        const bulkLogs = matchingDates.map(date => ({
            date,
            hours: hoursDecimal,
            type: payload.type as 'independent' | 'supervision'
        }))
        
        await validatePlanLimitsBulk(studentId, bulkLogs)

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
                            customSetting: payload.customSetting,
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
                            customSetting: payload.customSetting,
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

        // ── Validation Guard ────────────────────────────
        await validatePlanLimits(hour.studentId, finalDate, finalHours, (data.type || 'independent') as any, logId)

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

        // ── Validation Guard ────────────────────────────
        await validatePlanLimits(hour.studentId, finalDate, finalHours, 'supervision', logId, finalSupervisionType as 'INDIVIDUAL' | 'GROUP')

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
export async function updateLogStatus(
    logId: string,
    type: 'INDEPENDENT' | 'SUPERVISED' | string,
    status: 'APPROVED' | 'REJECTED' | 'PENDING',
    rejectReason?: string
): Promise<{ success?: boolean; error?: string }> {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = String((session.user as any).role).toLowerCase()
    const userId = session.user.id

    if (role !== 'supervisor' && role !== 'office' && role !== 'qa') {
        return { error: 'Forbidden: You do not have permission to update log status.' }
    }

    try {
        if (type === 'INDEPENDENT') {
            const hour = await prisma.independentHour.findUnique({
                where: { id: logId },
                include: { student: true }
            })
            if (!hour) return { error: 'Independent log not found' }

            // Security: If supervisor, verify assignment
            if (role === 'supervisor') {
                const supervisor = await prisma.supervisor.findUnique({ where: { userId } })
                if (!supervisor) return { error: 'Supervisor profile not found' }
                
                const assignment = await prisma.studentSupervisor.findFirst({
                    where: { studentId: hour.studentId, supervisorId: supervisor.id }
                })
                const legacyMatch = hour.student.supervisorId === supervisor.id

                if (!assignment && !legacyMatch) {
                    return { error: 'Forbidden: This student is not assigned to you.' }
                }
            }

            await prisma.independentHour.update({
                where: { id: logId },
                data: { status, rejectReason: status === 'REJECTED' ? rejectReason : null }
            })
        } else {
            const hour = await prisma.supervisionHour.findUnique({
                where: { id: logId }
            })
            if (!hour) return { error: 'Supervision log not found' }

            // Security: If supervisor, verify they are the assigned supervisor
            if (role === 'supervisor') {
                const supervisor = await prisma.supervisor.findUnique({ where: { userId } })
                if (!supervisor || (hour.supervisorId !== supervisor.id)) {
                    return { error: 'Forbidden: You are not the supervisor for this log.' }
                }
            }

            await prisma.supervisionHour.update({
                where: { id: logId },
                data: { status, rejectReason: status === 'REJECTED' ? rejectReason : null }
            })
        }

        revalidatePath('/student/timesheet')
        revalidatePath('/supervisor/timesheet')
        revalidatePath('/office/supervision-logs')

        return { success: true }
    } catch (err) {
        console.error('updateLogStatus error:', err)
        return { error: 'Failed to update log status' }
    }
}

export async function getStudentHoursRemaining(studentId: string, type: 'independent' | 'supervision') {
    try {
        const student = await prisma.student.findUnique({
            where: { id: studentId }
        })
        if (!student) return { error: "Student not found" }

        let plan = null;
        if (student.planTemplateId) {
            plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
        }

        const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
        
        let supervisedPercentage = 0.05
        if (student.supervisionPercentage) {
            const sp = Number(student.supervisionPercentage)
            supervisedPercentage = sp > 1 ? sp / 100 : sp
        } else if (plan?.supervisedPercentage) {
            supervisedPercentage = Number(plan.supervisedPercentage)
        }

        const maxSupervisedHoursTotal = Number(plan?.amountSupHours) || (totalPlanHours * supervisedPercentage)
        const maxIndependentHours = (student.independentHoursTarget && student.independentHoursTarget > 0) 
            ? student.independentHoursTarget 
            : totalPlanHours - maxSupervisedHoursTotal

        if (type === 'independent') {
            const lifetimeIndep = await prisma.independentHour.aggregate({ 
                where: { studentId, status: { not: 'REJECTED' } }, 
                _sum: { hours: true } 
            })
            const accumulated = Number(lifetimeIndep._sum.hours) || 0
            return { remaining: Math.max(0, maxIndependentHours - accumulated), target: maxIndependentHours }
        } else {
            const lifetimeSup = await prisma.supervisionHour.aggregate({ 
                where: { studentId, status: { not: 'REJECTED' } }, 
                _sum: { hours: true } 
            })
            
            const groupAttLifetime = await prisma.groupSupervisionAttendance.findMany({
                where: { studentId, attended: true }
            })
            const syncedGroupSessionIds = new Set(
                (await prisma.supervisionHour.findMany({
                    where: { studentId, supervisionType: 'GROUP', groupSessionId: { not: null } },
                    select: { groupSessionId: true }
                })).map(h => h.groupSessionId)
            )
            const extraGroupHours = groupAttLifetime.filter(a => !syncedGroupSessionIds.has(a.sessionId)).length

            const accumulated = (Number(lifetimeSup._sum.hours) || 0) + extraGroupHours
            return { remaining: Math.max(0, maxSupervisedHoursTotal - accumulated), target: maxSupervisedHoursTotal }
        }
    } catch (error) {
        console.error("Error fetching remaining hours:", error)
        return { error: "Failed to calculate remaining hours" }
    }
}
