import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getMonthStats(studentId: string, date: Date = new Date()) {
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const independent = await prisma.independentHour.findMany({
        where: { studentId, date: { gte: start, lte: end } }
    })

    const supervision = await prisma.supervisionHour.findMany({
        where: { studentId, date: { gte: start, lte: end } }
    })

    const totalIndependent = independent.reduce((sum, h) => sum + Number(h.hours), 0)
    const totalSupervision = supervision.reduce((sum, h) => sum + Number(h.hours), 0)
    const total = totalIndependent + totalSupervision

    const restrictedIndependent = independent
        .filter(h => h.activityType === 'RESTRICTED')
        .reduce((sum, h) => sum + Number(h.hours), 0)

    const restrictedSupervision = supervision
        .filter(h => h.activityType === 'RESTRICTED')
        .reduce((sum, h) => sum + Number(h.hours), 0)

    const totalRestricted = restrictedIndependent + restrictedSupervision
    const restrictedPercentage = total > 0 ? (totalRestricted / total) * 100 : 0

    const supervisionPercentage = total > 0 ? (totalSupervision / total) * 100 : 0

    return {
        total,
        totalIndependent,
        totalSupervision,
        totalRestricted,
        restrictedPercentage,
        supervisionPercentage,
        limit: 130
    }
}
