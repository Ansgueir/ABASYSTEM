import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"

export async function generateMonthlyInvoices() {
    try {
        const today = new Date()

        // Find all students with APPROVED hours not yet invoiced
        const students = await prisma.student.findMany()

        let generatedCount = 0

        for (const student of students) {
            // Only APPROVED hours with no invoice yet
            const unbilledHours = await prisma.supervisionHour.findMany({
                where: {
                    studentId: student.id,
                    status: "APPROVED",
                    invoiceId: null
                }
            })

            if (unbilledHours.length === 0) continue

            // Resolve hourlyRate: plan > student fallback
            let hourlyRate = Number((student as any).hourlyRate || 0)
            if ((student as any).planTemplateId) {
                const plan = await (prisma as any).plan.findUnique({
                    where: { id: (student as any).planTemplateId },
                    select: { hourlyRate: true }
                })
                if (plan?.hourlyRate) hourlyRate = Number(plan.hourlyRate)
            }

            // Use amountBilled already set on each hour (set at approval time),
            // fall back to hourlyRate × hours only if amountBilled is 0/null
            const totalAmountDue = unbilledHours.reduce((sum, h) => {
                const billed = Number(h.amountBilled || 0)
                return sum + (billed > 0 ? billed : Number(h.hours) * hourlyRate)
            }, 0)

            if (totalAmountDue <= 0) continue

            await prisma.$transaction(async (tx) => {
                // Create Invoice with computed total
                const invoice = await tx.invoice.create({
                    data: {
                        studentId: student.id,
                        invoiceDate: today,
                        amountDue: totalAmountDue,
                        amountPaid: 0,
                        status: InvoiceStatus.SENT,
                        sentAt: new Date()
                    }
                })

                // Link hours → set status BILLED and solidify amountBilled
                for (const h of unbilledHours) {
                    const amountBilled = Number(h.amountBilled || 0) > 0
                        ? Number(h.amountBilled)
                        : Number(h.hours) * hourlyRate

                    await tx.supervisionHour.update({
                        where: { id: h.id },
                        data: {
                            status: "BILLED",
                            invoiceId: invoice.id,
                            amountBilled
                        }
                    })
                }
            })

            generatedCount++
        }

        return { success: true, count: generatedCount }
    } catch (error) {
        console.error("Error generating invoices:", error)
        return { success: false, error }
    }
}
