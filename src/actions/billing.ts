"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"

export async function markInvoiceAsPaid(invoiceId: string, amountPaid: number, paymentMethod: string) {
    const session = await auth()
    if (!session || !session.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") {
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
        const newPayment = await prisma.studentPayment.create({
            data: {
                studentId: invoice.studentId,
                paymentDate: new Date(),
                amount: amountPaid,
                paymentType: "CHECK", // Default or map from input
                notes: `Payment for Invoice #${invoiceId}. Method: ${paymentMethod}`
            }
        })

        await logAudit({
            action: "UPDATE",
            entity: "Invoice",
            entityId: invoiceId,
            details: `Marked invoice as PAID for amount $${amountPaid}`,
            oldValues: { status: invoice.status, amountPaid: invoice.amountPaid },
            newValues: { status: InvoiceStatus.PAID, amountPaid: amountPaid }
        })

        await logAudit({
            action: "CREATE",
            entity: "Payment",
            entityId: newPayment.id,
            details: `Created student payment record for invoice #${invoiceId}`,
            newValues: newPayment
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
                const currentBalance = Number(existingPayment.balanceDue)
                const newBalance = Math.max(0, currentBalance - commissionAmount)
                const newPaid = Number(existingPayment.amountAlreadyPaid) + commissionAmount
                const currentAmtDue = Number(existingPayment.amountDue)

                // If amountDue was 0 due to an hourly rate bug, self-heal it to match reality
                const newAmtDue = Math.max(currentAmtDue, newPaid + newBalance)

                await prisma.supervisorPayment.update({
                    where: { id: existingPayment.id },
                    data: {
                        balanceDue: newBalance,
                        amountAlreadyPaid: newPaid,
                        amountPaidThisMonth: { increment: commissionAmount },
                        amountDue: newAmtDue
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

    const user = session.user as any
    const role = String(user.role).toLowerCase()

    if (role !== "office" && role !== "qa") {
        return { error: "Unauthorized role" }
    }

    // All office users and qa can run invoicing.


    // Dynamic import to avoid circular dependency if any? No, lib is fine.
    const { generateMonthlyInvoices } = await import("@/lib/invoicing")

    const result = await generateMonthlyInvoices()
    if (result.success) {
        await logAudit({
            action: "CREATE",
            entity: "System",
            details: `Generated ${result.count} monthly invoices`
        })
        revalidatePath("/office/payments")
        return { success: true, count: result.count }
    } else {
        return { error: "Failed to generate invoices" }
    }
}
