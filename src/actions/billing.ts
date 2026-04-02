"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { InvoiceStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { logAudit } from "@/lib/audit"

/**
 * WATERFALL PAYOUT ENGINE
 * 
 * Fórmula exacta por transacción:
 * 1. supervisorCapTotal = invoice.amountDue * supervisor.paymentPercentage
 * 2. supervisorCapRemainingBefore = última entrada del ledger para esta factura
 *    (Si primer pago: = supervisorCapTotal)
 * 3. maxPayThisTx = paymentAmount * 0.5  (tope del 50%)
 * 4. supervisorPayout = IF(rem > 0, MIN(maxPayThisTx, rem), 0)
 * 5. officePayout = paymentAmount - supervisorPayout
 * 6. supervisorCapRemainingAfter = rem - supervisorPayout
 * 
 * Test case obligatorio:
 * Factura $5000, Supervisor 40% → Cap $2000
 * Pago $500 → Sup recibe $250, Oficina $250, Rem baja a $1750
 * ...cuando Rem = 0, pago $1000 → Sup recibe $0, Oficina recibe $1000
 */

export async function markInvoiceAsPaid(
    invoiceId: string,
    paymentAmount: number,
    paymentMethod: string
) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    const officeRole = (session.user as any).officeRole
    if (officeRole !== "SUPER_ADMIN") return { error: "Forbidden: Only Super Admin can process payments" }

    try {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                student: {
                    include: { supervisor: true }
                }
            }
        })

        if (!invoice) return { error: "Invoice not found" }
        if (invoice.status === InvoiceStatus.PAID) return { error: "Invoice already fully paid" }

        const student = invoice.student
        const supervisor = student.supervisor
        const invoiceTotal = Number(invoice.amountDue)
        const alreadyPaid = Number(invoice.amountPaid)
        const newTotalPaid = alreadyPaid + paymentAmount

        // ─── WATERFALL MATH ─────────────────────────────────────────────────────

        let supervisorPayout = 0
        let officePayout = paymentAmount

        if (supervisor && student.supervisorId && supervisor.paymentPercentage) {
            const payPercent = Number(supervisor.paymentPercentage) // e.g. 0.40

            // PASO 1: Tope total del supervisor para ESTA factura
            const supervisorCapTotal = invoiceTotal * payPercent

            // PASO 2: Leer el remanente actual (última entrada del ledger para esta factura)
            const lastEntry = await prisma.supervisorLedgerEntry.findFirst({
                where: { invoiceId },
                orderBy: { createdAt: 'desc' }
            })

            const supervisorCapRemainingBefore = lastEntry
                ? Number(lastEntry.supervisorCapRemainingAfter)
                : supervisorCapTotal // Primer pago: remanente = tope total

            // PASO 3: Tope del 50% transaccional
            const maxPayThisTx = paymentAmount * 0.5

            // PASO 4: Pago real al supervisor (LA REGLA DE ORO)
            if (supervisorCapRemainingBefore > 0) {
                supervisorPayout = Math.min(maxPayThisTx, supervisorCapRemainingBefore)
            } else {
                supervisorPayout = 0
            }

            // PASO 5: Pago a la oficina
            officePayout = paymentAmount - supervisorPayout

            // PASO 6: Nuevo remanente
            const supervisorCapRemainingAfter = supervisorCapRemainingBefore - supervisorPayout

            // PERSISTIR en SupervisorLedgerEntry (doble entrada transaccional)
            await prisma.supervisorLedgerEntry.create({
                data: {
                    invoiceId,
                    supervisorId: student.supervisorId,
                    studentId: student.id,
                    paymentFromStudent: paymentAmount,
                    supervisorCapTotal,
                    supervisorCapRemainingBefore,
                    supervisorPayout,
                    officePayout,
                    supervisorCapRemainingAfter
                }
            })
        }

        // ─── ACTUALIZAR INVOICE ─────────────────────────────────────────────────

        const isPaidInFull = newTotalPaid >= invoiceTotal - 0.01 // Tolerancia de 1 centavo
        const newStatus = isPaidInFull ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                amountPaid: newTotalPaid,
                status: newStatus
            }
        })

        // ─── REGISTRO DE PAGO DEL ESTUDIANTE ────────────────────────────────────

        const newPayment = await prisma.studentPayment.create({
            data: {
                studentId: student.id,
                paymentDate: new Date(),
                amount: paymentAmount,
                paymentType: (paymentMethod as any) || "CHECK",
                notes: `Waterfall payment for Invoice #${invoiceId}. Supervisor: $${supervisorPayout.toFixed(2)}, Office: $${officePayout.toFixed(2)}`
            }
        })

        await logAudit({
            action: "UPDATE",
            entity: "Invoice",
            entityId: invoiceId,
            details: `Waterfall payment of $${paymentAmount}. Supervisor: $${supervisorPayout.toFixed(2)}, Office: $${officePayout.toFixed(2)}. Status → ${newStatus}`,
            oldValues: { status: invoice.status, amountPaid: invoice.amountPaid },
            newValues: { status: newStatus, amountPaid: newTotalPaid, supervisorPayout, officePayout }
        })

        revalidatePath("/office/payments")
        return {
            success: true,
            supervisorPayout: supervisorPayout.toFixed(2),
            officePayout: officePayout.toFixed(2),
            newStatus
        }

    } catch (error: any) {
        console.error("Waterfall Payment Error:", error)
        return { error: `Failed to process payment: ${error.message}` }
    }
}

/**
 * Sends an invoice (READY_TO_GO → SENT)
 */
export async function sendInvoice(invoiceId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    try {
        const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } })
        if (!invoice) return { error: "Invoice not found" }
        if (invoice.status !== "READY_TO_GO" as any) return { error: "Invoice is not in READY_TO_GO state" }

        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.SENT,
                sentAt: new Date()
            }
        })

        await logAudit({
            action: "UPDATE",
            entity: "Invoice",
            entityId: invoiceId,
            details: "Invoice sent to student (READY_TO_GO → SENT)"
        })

        revalidatePath("/office/payments")
        return { success: true }
    } catch (error: any) {
        return { error: error.message }
    }
}

/**
 * Consolidates APPROVED hours into READY_TO_GO invoices.
 * Replaces the old "Run Invoicing" batch button.
 * Used internally (cron or manual trigger by SUPER_ADMIN).
 */
export async function generateInvoicesAction() {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const user = session.user as any
    const role = String(user.role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    const officeRole = String(user.officeRole || "")
    if (officeRole !== "SUPER_ADMIN") return { error: "Forbidden: Only Super Admin can generate invoices" }

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
