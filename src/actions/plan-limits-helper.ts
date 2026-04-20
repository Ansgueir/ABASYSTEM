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
    
    if (currentMonthly + newHours > maxHoursPerMonth) {
        throw new Error(`Límite Mensual Excedido: El plan de ${student.fullName} permite un máximo de ${maxHoursPerMonth}h mensuales. Has intentado sumar ${(currentMonthly + newHours).toFixed(2)}h. Solo quedan ${(maxHoursPerMonth - currentMonthly).toFixed(2)}h disponibles para este mes.`)
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
        throw new Error(`Límite de Plan Maestro: ${student.fullName} ya tiene ${(totalIndep + totalSup).toFixed(2)}h de las ${totalPlanHours}h totales permitidas. El registro actual de ${newHours.toFixed(2)}h excede el tope total del plan.`);
    }

    // --- MODALITY LIMIT CHECK ---
    if (hourType === 'independent') {
        if (totalIndep + newHours > maxIndependentHours) {
            throw new Error(`Límite de Horas Independientes: El plan permite un máximo de ${maxIndependentHours.toFixed(1)}h independientes. Total acumulado: ${totalIndep.toFixed(2)}h. Disponibles: ${(maxIndependentHours - totalIndep).toFixed(2)}h.`)
        }
    } else {
        if (totalSup + newHours > maxSupervisedHours) {
            throw new Error(`Límite de Horas Supervisadas: El plan permite un máximo de ${maxSupervisedHours.toFixed(1)}h supervisadas (5% o similar). Total acumulado: ${totalSup.toFixed(2)}h. Disponibles: ${(maxSupervisedHours - totalSup).toFixed(2)}h.`)
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
        throw new Error(`Operación en Bloque Rechazada: Esta carga masiva de ${totalNewHours.toFixed(2)}h excedería el límite total del plan (${totalPlanHours}h). Actualmente llevas ${(totalIndep + totalSup).toFixed(2)}h.`);
    }

    if (totalNewIndep > 0 && totalIndep + totalNewIndep > maxIndependentHours) {
        throw new Error(`Operación en Bloque Rechazada: La carga de ${totalNewIndep.toFixed(2)}h independientes excede el límite permitido para esta modalidad (${maxIndependentHours.toFixed(1)}h).`);
    }

    if (totalNewSup > 0 && totalSup + totalNewSup > maxSupervisedHours) {
        throw new Error(`Operación en Bloque Rechazada: La carga de ${totalNewSup.toFixed(2)}h supervisadas excede el límite permitido (${maxSupervisedHours.toFixed(1)}h).`);
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
            throw new Error(`Límite Mensual en Bloque: Para el mes ${info.month + 1}/${info.year}, tu registro masivo de ${info.hours.toFixed(2)}h excede el tope mensual de ${maxHoursPerMonth}h.`);
        }
    }
}

