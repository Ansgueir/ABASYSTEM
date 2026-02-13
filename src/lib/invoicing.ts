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
            // Check if invoice already exists for this month
            const existingInvoice = await prisma.invoice.findFirst({
                where: {
                    studentId: student.id,
                    invoiceDate: {
                        gte: firstDayOfMonth,
                        lt: new Date(today.getFullYear(), today.getMonth() + 1, 1)
                    }
                }
            })

            if (existingInvoice) continue

            // Create Invoice
            // Ensure amountToPay is handled correctly (Decimal vs Number)
            await prisma.invoice.create({
                data: {
                    studentId: student.id,
                    invoiceDate: today,
                    amountDue: student.amountToPay,
                    amountPaid: 0,
                    status: InvoiceStatus.SENT,
                    sentAt: new Date()
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
