import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function validatePlanLimits(studentId: string, date: Date, newHours: number, hourType: 'independent' | 'supervision', excludeLogId?: string) {
    const student = await prisma.student.findUnique({
        where: { id: studentId }
    })
    if (!student) throw new Error("Student not found")

    let plan = null;
    if (student.planTemplateId) {
        plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
    }

    // 1. Get targets (Default fallback to old standards if no plan)
    const maxHoursPerMonth = student.hoursPerMonth || plan?.hoursPerMonth || 130
    const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
    
    // Supervised percentage logic
    let supervisedPercentage = 0.05
    if (student.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisedPercentage = sp > 1 ? sp / 100 : sp
    } else if (plan?.supervisedPercentage) {
        supervisedPercentage = Number(plan.supervisedPercentage)
    }

    console.log(`[Plan-Validation-Debug] Student: ${student.fullName}, Monthly Limit: ${maxHoursPerMonth}, Lifetime Limit: ${totalPlanHours}, Supervised%: ${supervisedPercentage}`)

    const maxSupervisedHours = Number(plan?.amountSupHours) || (totalPlanHours * supervisedPercentage)
    
    let maxIndependentHours = 0
    if (student.independentHoursTarget && student.independentHoursTarget > 0) {
        maxIndependentHours = student.independentHoursTarget
    } else {
        maxIndependentHours = totalPlanHours - maxSupervisedHours
    }

    // --- MONTHLY LIMIT CHECK ---
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const indepCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    if (excludeLogId) indepCondition.id = { not: excludeLogId }
    
    const supCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    if (excludeLogId) supCondition.id = { not: excludeLogId }

    const monthlyIndep = await prisma.independentHour.aggregate({ where: indepCondition, _sum: { hours: true } })
    const monthlySup = await prisma.supervisionHour.aggregate({ where: supCondition, _sum: { hours: true } })

    const currentMonthly = (Number(monthlyIndep._sum.hours) || 0) + (Number(monthlySup._sum.hours) || 0)
    
    console.log(`[Plan-Validation-Debug] Month: ${start.toISOString()} to ${end.toISOString()}, Current: ${currentMonthly}, New: ${newHours}, Max: ${maxHoursPerMonth}`)

    if (currentMonthly + newHours > maxHoursPerMonth) {
        throw new Error(`Monthly Limit Exceeded: The plan for ${student.fullName} allows a maximum of ${maxHoursPerMonth}h per month. You tried to add ${(currentMonthly + newHours).toFixed(2)}h. Only ${(maxHoursPerMonth - currentMonthly).toFixed(2)}h are available for this month.`)
    }

    // --- LIFETIME LIMIT CHECK ---
    const indepLifetimeCondition: any = { studentId, status: { not: 'REJECTED' } }
    if (excludeLogId) indepLifetimeCondition.id = { not: excludeLogId }

    const supLifetimeCondition: any = { studentId, status: { not: 'REJECTED' } }
    if (excludeLogId) supLifetimeCondition.id = { not: excludeLogId }

    const lifetimeIndep = await prisma.independentHour.aggregate({ where: indepLifetimeCondition, _sum: { hours: true } })
    const lifetimeSup = await prisma.supervisionHour.aggregate({ where: supLifetimeCondition, _sum: { hours: true } })

    const totalIndep = Number(lifetimeIndep._sum.hours) || 0
    const totalSup = Number(lifetimeSup._sum.hours) || 0

    if (totalIndep + totalSup + newHours > totalPlanHours) {
        throw new Error(`Master Plan Limit: ${student.fullName} already has ${(totalIndep + totalSup).toFixed(2)}h of the ${totalPlanHours}h total hours allowed. The current entry of ${newHours.toFixed(2)}h exceeds the plan's total cap.`);
    }

    // --- MODALITY LIMIT CHECK ---
    if (hourType === 'independent') {
        if (totalIndep + newHours > maxIndependentHours) {
            throw new Error(`Independent Hours Limit: The plan allows a maximum of ${maxIndependentHours.toFixed(1)}h independent hours. Total accumulated: ${totalIndep.toFixed(2)}h. Available: ${(maxIndependentHours - totalIndep).toFixed(2)}h.`)
        }
    } else {
        if (totalSup + newHours > maxSupervisedHours) {
            throw new Error(`Supervised Hours Limit: The plan allows a maximum of ${maxSupervisedHours.toFixed(1)}h supervised hours (5% or similar). Total accumulated: ${totalSup.toFixed(2)}h. Available: ${(maxSupervisedHours - totalSup).toFixed(2)}h.`)
        }
    }
}

/**
 * Validates a bulk logging operation against plan limits.
 * Checks lifetime limits for the TOTAL hours being logged,
 * and monthly limits for each month involved.
 */
export async function validatePlanLimitsBulk(studentId: string, logs: { date: Date, hours: number, type: 'independent' | 'supervision' }[]) {
    if (logs.length === 0) return

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) throw new Error("Student not found")

    let plan = null;
    if (student.planTemplateId) {
        plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
    }

    const maxHoursPerMonth = student.hoursPerMonth || plan?.hoursPerMonth || 130
    const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
    
    let supervisedPercentage = 0.05
    if (student.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisedPercentage = sp > 1 ? sp / 100 : sp
    } else if (plan?.supervisedPercentage) {
        supervisedPercentage = Number(plan.supervisedPercentage)
    }

    const maxSupervisedHours = Number(plan?.amountSupHours) || (totalPlanHours * supervisedPercentage)
    const maxIndependentHours = (student.independentHoursTarget && student.independentHoursTarget > 0) 
        ? student.independentHoursTarget 
        : totalPlanHours - maxSupervisedHours

    // 1. LIFETIME TOTAL CHECK
    const totalNewHours = logs.reduce((sum, l) => sum + l.hours, 0)
    const totalNewIndep = logs.filter(l => l.type === 'independent').reduce((sum, l) => sum + l.hours, 0)
    const totalNewSup = logs.filter(l => l.type === 'supervision').reduce((sum, l) => sum + l.hours, 0)

    const lifetimeIndep = await prisma.independentHour.aggregate({ where: { studentId, status: { not: 'REJECTED' } }, _sum: { hours: true } })
    const lifetimeSup = await prisma.supervisionHour.aggregate({ where: { studentId, status: { not: 'REJECTED' } }, _sum: { hours: true } })

    const totalIndep = Number(lifetimeIndep._sum.hours) || 0
    const totalSup = Number(lifetimeSup._sum.hours) || 0

    if (totalIndep + totalSup + totalNewHours > totalPlanHours) {
        throw new Error(`Bulk Operation Rejected: This massive load of ${totalNewHours.toFixed(2)}h would exceed the total plan limit (${totalPlanHours}h). You currently have ${(totalIndep + totalSup).toFixed(2)}h.`);
    }

    if (totalNewIndep > 0 && totalIndep + totalNewIndep > maxIndependentHours) {
        throw new Error(`Bulk Operation Rejected: The load of ${totalNewIndep.toFixed(2)}h independent hours exceeds the allowed limit for this modality (${maxIndependentHours.toFixed(1)}h).`);
    }

    if (totalNewSup > 0 && totalSup + totalNewSup > maxSupervisedHours) {
        throw new Error(`Bulk Operation Rejected: The load of ${totalNewSup.toFixed(2)}h supervised hours exceeds the allowed limit (${maxSupervisedHours.toFixed(1)}h).`);
    }

    // 2. MONTHLY CHECKS
    const monthsAffected = new Map<string, { year: number, month: number, hours: number }>()
    for (const log of logs) {
        const key = `${log.date.getFullYear()}-${log.date.getMonth()}`
        const existing = monthsAffected.get(key) || { year: log.date.getFullYear(), month: log.date.getMonth(), hours: 0 }
        existing.hours += log.hours
        monthsAffected.set(key, existing)
    }

    for (const [_, info] of monthsAffected) {
        const start = startOfMonth(new Date(info.year, info.month, 15))
        const end = endOfMonth(start)

        const mIndep = await prisma.independentHour.aggregate({ where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }, _sum: { hours: true } })
        const mSup = await prisma.supervisionHour.aggregate({ where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }, _sum: { hours: true } })

        const currentMonthly = (Number(mIndep._sum.hours) || 0) + (Number(mSup._sum.hours) || 0)
        if (currentMonthly + info.hours > maxHoursPerMonth) {
            throw new Error(`Bulk Monthly Limit: For the month ${info.month + 1}/${info.year}, your massive entry of ${info.hours.toFixed(2)}h exceeds the monthly cap of ${maxHoursPerMonth}h.`);
        }
    }
}

