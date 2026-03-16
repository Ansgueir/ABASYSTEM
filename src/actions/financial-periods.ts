"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { serialize } from "@/lib/serialize"

export async function generateOrUpdateFinancialPeriods(studentId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN"
    if (!isSuperAdmin) return { error: "Permission Denied" }

    try {
        const student = await (prisma as any).student.findUnique({
            where: { id: studentId },
            include: { financialPeriods: true }
        })

        if (!student) return { error: "Student not found" }

        // Start from contract start date or just start Date
        let baseDate = student.startDate

        const periods: any[] = []
        let accumulatedDueOffice = 0
        let accumulatedPaidOffice = 0
        let accumulatedPaidAnalyst = 0

        // In a real scenario we need invoices and payments to exact match,
        // but the DB schema has `amountDueOffice`, `amountDueAnalyst` which can be populated.
        // If they already exist, we maintain them and just recalculate accumulatives.

        const existingPeriods = (student as any).financialPeriods?.sort((a: any, b: any) => a.periodNumber - b.periodNumber) || []

        for (let i = 1; i <= 48; i++) {
            const existing = existingPeriods.find((p: any) => p.periodNumber === i)

            // Calculate label
            const periodDate = new Date(baseDate)
            periodDate.setMonth(periodDate.getMonth() + (i - 1))
            const label = periodDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

            let amountDueOffice = existing ? Number(existing.amountDueOffice) : 0
            let amountDueAnalyst = existing ? Number(existing.amountDueAnalyst) : 0

            accumulatedDueOffice += amountDueOffice

            const accDueOffice = (i === 1 ? amountDueOffice : Number(periods[i - 2].accumulatedDueOffice) + amountDueOffice)

            const accPaidOffice = existing ? Number(existing.accumulatedPaidOffice) : 0
            const accPaidAnalyst = existing ? Number(existing.accumulatedPaidAnalyst) : 0

            periods.push({
                periodNumber: i,
                monthYearLabel: label,
                amountDueOffice,
                amountDueAnalyst,
                accumulatedDueOffice: accDueOffice,
                accumulatedPaidOffice: accPaidOffice,
                accumulatedPaidAnalyst: accPaidAnalyst
            })
        }

        // Upsert all periods
        await (prisma as any).$transaction(
            periods.map(p => (prisma as any).financialPeriod.upsert({
                where: { studentId_periodNumber: { studentId, periodNumber: p.periodNumber } },
                update: {
                    monthYearLabel: p.monthYearLabel,
                    amountDueOffice: p.amountDueOffice,
                    amountDueAnalyst: p.amountDueAnalyst,
                    accumulatedDueOffice: p.accumulatedDueOffice,
                    accumulatedPaidOffice: p.accumulatedPaidOffice,
                    accumulatedPaidAnalyst: p.accumulatedPaidAnalyst,
                },
                create: {
                    studentId,
                    periodNumber: p.periodNumber,
                    monthYearLabel: p.monthYearLabel,
                    amountDueOffice: p.amountDueOffice,
                    amountDueAnalyst: p.amountDueAnalyst,
                    accumulatedDueOffice: p.accumulatedDueOffice,
                    accumulatedPaidOffice: p.accumulatedPaidOffice,
                    accumulatedPaidAnalyst: p.accumulatedPaidAnalyst,
                }
            }))
        )

        revalidatePath(`/office/students/${studentId}`)
        return { success: true }
    } catch (error: any) {
        console.error(error)
        return { error: error.message }
    }
}

export async function updateFinancialPeriod(studentId: string, periodNumber: number, data: any) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN"
    if (!isSuperAdmin) return { error: "Permission Denied" }

    try {
        await (prisma as any).financialPeriod.update({
            where: { studentId_periodNumber: { studentId, periodNumber } },
            data: {
                amountDueOffice: parseFloat(data.amountDueOffice) || 0,
                amountDueAnalyst: parseFloat(data.amountDueAnalyst) || 0,
                accumulatedPaidOffice: parseFloat(data.accumulatedPaidOffice) || 0,
                accumulatedPaidAnalyst: parseFloat(data.accumulatedPaidAnalyst) || 0,
            }
        })

        // Recalculate all accumulatives for this student
        const allPeriods = await (prisma as any).financialPeriod.findMany({
            where: { studentId },
            orderBy: { periodNumber: 'asc' }
        })

        let accDueOffice = 0
        for (const p of allPeriods) {
            accDueOffice += Number(p.amountDueOffice)
            await (prisma as any).financialPeriod.update({
                where: { id: p.id },
                data: {
                    accumulatedDueOffice: accDueOffice
                }
            })
        }

        revalidatePath(`/office/students/${studentId}`)
        return { success: true }
    } catch (error: any) {
        console.error(error)
        return { error: error.message }
    }
}
