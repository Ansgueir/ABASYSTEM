import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"

export async function generateMonthlyInvoices() {
    try {
        const today = new Date()
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

        // 1. Find active students
        const students = await prisma.student.findMany({
            where: { status: "ACTIVE" }
        })

        let generatedCount = 0

        for (const student of students) {
            // Include hours from this month or previous that are APPROVED but not billed
            const unbilledHours = await prisma.supervisionHour.findMany({
                where: {
                    studentId: student.id,
                    status: "APPROVED",
                    invoiceId: null
                }
            })

            if (unbilledHours.length === 0) continue

            const hourlyRate = Number(student.hourlyRate || 0)
            const totalAmountDue = unbilledHours.reduce((sum, h) => sum + (Number(h.hours) * hourlyRate), 0)

            if (totalAmountDue <= 0) continue

            await prisma.$transaction(async (tx) => {
                // Create Invoice
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

                // Link hours and update status to BILLED, and solidify the amount billed per hour
                for (const h of unbilledHours) {
                    await tx.supervisionHour.update({
                        where: { id: h.id },
                        data: {
                            status: "BILLED",
                            invoiceId: invoice.id,
                            amountBilled: Number(h.hours) * hourlyRate
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
