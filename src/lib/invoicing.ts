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

            const totalAmountDue = unbilledHours.reduce((sum, h) => sum + Number(h.amountBilled || 0), 0)

            if (totalAmountDue <= 0) continue

            // Create Invoice
            const invoice = await prisma.invoice.create({
                data: {
                    studentId: student.id,
                    invoiceDate: today,
                    amountDue: totalAmountDue,
                    amountPaid: 0,
                    status: InvoiceStatus.SENT,
                    sentAt: new Date()
                }
            })

            // Link hours and update status to BILLED
            await prisma.supervisionHour.updateMany({
                where: {
                    id: { in: unbilledHours.map(h => h.id) }
                },
                data: {
                    status: "BILLED",
                    invoiceId: invoice.id
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
