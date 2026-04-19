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

    // Use Student field over plan if available (as student can have overrides)
    const maxHoursPerMonth = student.hoursPerMonth || plan?.hoursPerMonth || 130
    const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
    
    // supervised percentage
    let supervisedPercentage = 0.05
    if (student.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisedPercentage = sp > 1 ? sp / 100 : sp
    } else if (plan?.supervisedPercentage) {
        supervisedPercentage = Number(plan.supervisedPercentage)
    }

    const maxSupervisedHours = totalPlanHours * supervisedPercentage
    
    let maxIndependentHours = 0
    if (student.independentHoursTarget && student.independentHoursTarget > 0) {
        maxIndependentHours = student.independentHoursTarget
    } else {
        maxIndependentHours = totalPlanHours - maxSupervisedHours
    }

    const start = startOfMonth(date)
    const end = endOfMonth(date)

    // Build conditions including the exclusion for updates
    const indepCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    if (excludeLogId) indepCondition.id = { not: excludeLogId }
    
    const supCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    if (excludeLogId) supCondition.id = { not: excludeLogId }

    const monthlyIndep = await prisma.independentHour.aggregate({
        where: indepCondition,
        _sum: { hours: true }
    })
    const monthlySup = await prisma.supervisionHour.aggregate({
        where: supCondition,
        _sum: { hours: true }
    })

    const currentMonthly = (Number(monthlyIndep._sum.hours) || 0) + (Number(monthlySup._sum.hours) || 0)
    if (currentMonthly + newHours > maxHoursPerMonth) {
        throw new Error(`Plan Limit Exceeded (${student.fullName}): Tu plan dicta un máximo de ${maxHoursPerMonth} horas por mes. Has intentado sumar ${(currentMonthly + newHours).toFixed(2)}h excediendo tu tope mensual.`)
    }

    const indepLifetimeCondition: any = { studentId, status: { not: 'REJECTED' } }
    if (excludeLogId) indepLifetimeCondition.id = { not: excludeLogId }

    const supLifetimeCondition: any = { studentId, status: { not: 'REJECTED' } }
    if (excludeLogId) supLifetimeCondition.id = { not: excludeLogId }

    const lifetimeIndep = await prisma.independentHour.aggregate({
        where: indepLifetimeCondition,
        _sum: { hours: true }
    })
    const lifetimeSup = await prisma.supervisionHour.aggregate({
        where: supLifetimeCondition,
        _sum: { hours: true }
    })

    const totalIndep = Number(lifetimeIndep._sum.hours) || 0
    const totalSup = Number(lifetimeSup._sum.hours) || 0

    if (totalIndep + totalSup + newHours > totalPlanHours) {
        throw new Error(`Plan Limit Exceeded (${student.fullName}): Has alcanzado el 100% de tu plan maestro (${totalPlanHours}h). Llevas ${(totalIndep + totalSup).toFixed(2)}h registradas. No puedes registrar más horas.`)
    }

    if (hourType === 'independent') {
        if (totalIndep + newHours > maxIndependentHours) {
            throw new Error(`Plan Limit Exceeded (${student.fullName}): Alcanzaste tu máxima capacidad de modalidad Independiente (${maxIndependentHours.toFixed(1)}h). Total actual: ${totalIndep.toFixed(2)}h.`)
        }
    } else {
        if (totalSup + newHours > maxSupervisedHours) {
            throw new Error(`Plan Limit Exceeded (${student.fullName}): Alcanzaste tu máxima capacidad de modalidad Supervisada (${maxSupervisedHours.toFixed(1)}h). Total actual: ${totalSup.toFixed(2)}h.`)
        }
    }
}
