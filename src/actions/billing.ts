"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function markInvoiceAsPaid(invoiceId: string, amountPaid: number, paymentMethod: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office") {
        return { error: "Unauthorized role" }
    }

    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { student: { include: { supervisor: true } } }
        })

        if (!invoice) return { error: "Invoice not found" }
        if (invoice.status === InvoiceStatus.PAID) return { error: "Invoice already paid" }

        // Update Invoice
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.PAID,
                amountPaid: amountPaid
            }
        })

        // Create Student Payment Record
        // Assuming PaymentType enum covers the method string, or cast/map
        // For now, let's assume it matches or find a default
        await prisma.studentPayment.create({
            data: {
                studentId: invoice.studentId,
                paymentDate: new Date(),
                amount: amountPaid,
                paymentType: "CHECK", // Default or map from input
                notes: `Payment for Invoice #${invoiceId}. Method: ${paymentMethod}`
            }
        })

        // Calculate Commission for Supervisor
        const student = invoice.student
        if (student.supervisor && student.supervisorId) {
            // Default 54% if not set? Schema has no default but business rule says 54% or 60%.
            // Schema: paymentPercentage Decimal?
            const percent = student.supervisor.paymentPercentage ? Number(student.supervisor.paymentPercentage) : 0.54

            const commissionAmount = Number(amountPaid) * percent

            const today = new Date()
            const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

            // Find or create record for this month/student/supervisor
            const existingPayment = await prisma.supervisorPayment.findFirst({
                where: {
                    supervisorId: student.supervisorId,
                    studentId: student.id,
                    monthYear: firstDayOfMonth
                }
            })

            if (existingPayment) {
                await prisma.supervisorPayment.update({
                    where: { id: existingPayment.id },
                    data: {
                        balanceDue: { decrement: commissionAmount },
                        amountAlreadyPaid: { increment: commissionAmount },
                        amountPaidThisMonth: { increment: commissionAmount }
                    }
                })
            } else {
                await prisma.supervisorPayment.create({
                    data: {
                        supervisorId: student.supervisorId,
                        studentId: student.id,
                        monthYear: firstDayOfMonth,
                        amountDue: commissionAmount,
                        amountPaidThisMonth: commissionAmount,
                        amountAlreadyPaid: commissionAmount,
                        balanceDue: 0
                    }
                })
            }
        }

        revalidatePath("/office/payments")
        return { success: true }

    } catch (error) {
        console.error("Payment Error:", error)
        return { error: "Failed to process payment" }
    }
}

export async function generateInvoicesAction() {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office") {
        return { error: "Unauthorized role" }
    }

    // Dynamic import to avoid circular dependency if any? No, lib is fine.
    const { generateMonthlyInvoices } = await import("@/lib/invoicing")

    const result = await generateMonthlyInvoices()
    if (result.success) {
        revalidatePath("/office/payments")
        return { success: true, count: result.count }
    } else {
        return { error: "Failed to generate invoices" }
    }
}
