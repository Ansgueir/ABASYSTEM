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

        if (supervisor && student.supervisorId) {
            // PRIORITY: Plan.supervisorCommission → Supervisor.paymentPercentage → default 0.54
            let payPercent = Number(supervisor.paymentPercentage || 0.54)

            // Try to resolve from student's assigned Plan
            if (student.planTemplateId) {
                const planRecord = await (prisma as any).plan.findUnique({
                    where: { id: student.planTemplateId },
                    select: { supervisorCommission: true }
                })
                if (planRecord?.supervisorCommission != null) {
                    payPercent = Number(planRecord.supervisorCommission)
                }
            }

            // PASO 1: Tope total del supervisor para ESTA factura
            const supervisorCapTotal = invoiceTotal * payPercent

            // PASO 2: Leer el remanente actual (última entrada del ledger para esta factura)
            const lastEntry = await (prisma as any).supervisorLedgerEntry.findFirst({
                where: { invoiceId },
                orderBy: { createdAt: 'desc' }
            })

            const supervisorCapRemainingBefore = lastEntry
                ? Number(lastEntry.supervisorCapRemainingAfter)
                : supervisorCapTotal // Primer pago: remanente = tope total

            // PASO 3: Tope transaccional = pago_ingresado * payPercent (comisión del mes)
            const maxPayThisTx = paymentAmount * payPercent

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

            // PASO 7: Plan snapshot para el modal (read del plan del alumno)
            let planMonthlyPayment: number | null = null
            let planHoursPerMonth: number | null = null
            let planSupervisedHours: number | null = null
            let planIndividualHours: number | null = null
            if (student.planTemplateId) {
                const plan = await (prisma as any).plan.findUnique({
                    where: { id: student.planTemplateId },
                    select: {
                        monthlyPayment: true,
                        hoursPerMonth: true,
                        amountSupHours: true,
                        numberOfMonths: true,
                        supervisedPercentage: true
                    }
                })
                if (plan) {
                    planMonthlyPayment = plan.monthlyPayment ? Number(plan.monthlyPayment) : null
                    planHoursPerMonth = plan.hoursPerMonth ?? null
                    // Horas supervisadas por mes = amountSupHours / numberOfMonths
                    if (plan.amountSupHours && plan.numberOfMonths && plan.numberOfMonths > 0) {
                        planSupervisedHours = Number(plan.amountSupHours) / plan.numberOfMonths
                    }
                    // Horas individuales por mes = hoursPerMonth * (1 - supervisedPct)
                    if (plan.hoursPerMonth && plan.supervisedPercentage != null) {
                        planIndividualHours = plan.hoursPerMonth * (1 - Number(plan.supervisedPercentage))
                    }
                }
            }

            // PERSISTIR en SupervisorLedgerEntry (doble entrada transaccional)
            await (prisma as any).supervisorLedgerEntry.create({
                data: {
                    invoiceId,
                    supervisorId: student.supervisorId,
                    studentId: student.id,
                    paymentFromStudent: paymentAmount,
                    supervisorCapTotal,
                    supervisorCapRemainingBefore,
                    supervisorPayout,
                    officePayout,
                    supervisorCapRemainingAfter,
                    // Plan snapshot
                    planMonthlyPayment,
                    planHoursPerMonth,
                    planSupervisedHours,
                    planIndividualHours,
                    // Status starts as PENDING until Super Office pays
                    payoutStatus: "PENDING"
                }
            })
        }

        // ─── ACTUALIZAR INVOICE ─────────────────────────────────────────────────

        const isPaidInFull = newTotalPaid >= invoiceTotal - 0.01 // Tolerancia de 1 centavo
        const newStatus = isPaidInFull ? InvoiceStatus.PAID : InvoiceStatus.SENT

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
        const invoice = await prisma.invoice.findUnique({ 
            where: { id: invoiceId },
            include: {
                student: {
                    include: { user: true }
                }
            } 
        })
        if (!invoice) return { error: "Invoice not found" }
        if (invoice.status !== ("READY_TO_GO" as any)) return { error: "Invoice is not in READY_TO_GO state" }

        // 1. Actualizar el estado en la DB
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                status: InvoiceStatus.SENT,
                sentAt: new Date()
            }
        })

        // 2. Crear Notificación para el Estudiante
        await prisma.notification.create({
            data: {
                userId: invoice.student.userId,
                title: "New Invoice Available",
                message: `An invoice for $${Number(invoice.amountDue).toFixed(2)} has been sent. Please review it in your payments section.`,
                type: "HOURS"
            }
        })

        // 3. Enviar Correo Electrónico
        if (invoice.student.email) {
            const { sendEmail } = await import("@/lib/email")
            await sendEmail({
                to: invoice.student.email,
                subject: `Your Invoice from ABA Supervision System (#${invoice.id.substring(0, 8)})`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <h2 style="color: #2563eb; margin: 0;">ABA Supervision System</h2>
                        </div>
                        <h3 style="color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">New Invoice Ready for Review</h3>
                        <p>Hello <strong>${invoice.student.fullName}</strong>,</p>
                        <p>A new invoice for your supervision fieldwork has been issued and is now available in your portal.</p>
                        
                        <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); padding: 20px; border-radius: 12px; margin: 25px 0; border: 1px solid #e2e8f0;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 0.875rem;">Invoice ID</td>
                                    <td style="padding: 5px 0; text-align: right; font-weight: 600;">#${invoice.id.substring(0, 8)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 0.875rem;">Total Amount</td>
                                    <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a; font-size: 1.125rem;">$${Number(invoice.amountDue).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 5px 0; color: #64748b; font-size: 0.875rem;">Billing Date</td>
                                    <td style="padding: 5px 0; text-align: right; font-weight: 600;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td>
                                </tr>
                            </table>
                        </div>

                        <p style="margin-bottom: 25px;">Please log in to the platform to view the full details and settle the pending balance.</p>
                        
                        <div style="text-align: center; margin-bottom: 30px;">
                            <a href="${process.env.NEXTAUTH_URL || 'https://aba.system.com'}/student/payments" 
                               style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 1rem; display: inline-block;">
                               View Invoice & Pay
                            </a>
                        </div>

                        <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">
                            <p>If you have any questions, please contact the Office administration.</p>
                            <p>© ${new Date().getFullYear()} ABA Supervision System. All rights reserved.</p>
                        </div>
                    </div>
                `
            })
        }

        await logAudit({
            action: "UPDATE",
            entity: "Invoice",
            entityId: invoiceId,
            details: `Invoice sent to student ${invoice.student.fullName} (READY_TO_GO → SENT)`
        })

        revalidatePath("/office/payments")
        revalidatePath("/student/payments")
        return { success: true }
    } catch (error: any) {
        console.error("Error sending invoice:", error)
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

/**
 * Records a Payout (Office -> Supervisor) for a specific invoice.
 */
export async function recordSupervisorPayout(data: {
    invoiceId: string
    supervisorId: string
    amount: number
    method: string
    reference?: string
    notes?: string
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    const officeRole = (session.user as any).officeRole
    if (officeRole !== "SUPER_ADMIN") return { error: "Forbidden: Only Super Admin can record payouts" }

    try {
        await (prisma as any).supervisorPayout.create({
            data: {
                invoiceId: data.invoiceId,
                supervisorId: data.supervisorId,
                amount: data.amount,
                method: data.method,
                reference: data.reference || null,
                notes: data.notes || null
            }
        })

        await logAudit({
            action: "CREATE",
            entity: "Payment",
            entityId: data.invoiceId,
            details: `Office paid $${data.amount} to supervisor (Invoice ${data.invoiceId.slice(-6)})`
        })

        revalidatePath("/office/payments")
        return { success: true }
    } catch (error: any) {
        console.error("Payout error:", error)
        return { error: error.message }
    }
}

/**
 * Pays a supervisor from a specific LedgerEntry (PENDING → PAID).
 * Saves manual fields and creates a SupervisorPayout transaction.
 * Pre-fills manual fields from the last PAID entry for the same student/supervisor.
 */
export async function payToSupervisorFromLedger(data: {
    ledgerEntryId: string
    amount: number
    supervisedHoursActual?: number
    individualHoursDelta?: number
    paymentMethod: string
    paymentReference?: string
    paymentNotes?: string
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Unauthorized role" }

    const officeRole = (session.user as any).officeRole
    if (officeRole !== "SUPER_ADMIN") return { error: "Forbidden: Only Super Admin can pay supervisors" }

    try {
        // 1. Fetch the ledger entry
        const entry = await (prisma as any).supervisorLedgerEntry.findUnique({
            where: { id: data.ledgerEntryId }
        })
        if (!entry) return { error: "Ledger entry not found" }
        if (entry.payoutStatus === "PAID") return { error: "This entry has already been paid" }

        const maxAllowed = Number(entry.supervisorPayout)
        if (data.amount > maxAllowed + 0.01) {
            return { error: `Amount exceeds max allowed for this entry ($${maxAllowed.toFixed(2)})` }
        }

        // 2. Pre-fill manual fields from last PAID entry for same student/supervisor
        //    (only used as fallback if caller didn't provide values)
        let supervisedHoursActual = data.supervisedHoursActual ?? null
        let individualHoursDelta = data.individualHoursDelta ?? null

        if (supervisedHoursActual == null || individualHoursDelta == null) {
            const lastPaid = await (prisma as any).supervisorLedgerEntry.findFirst({
                where: {
                    supervisorId: entry.supervisorId,
                    studentId: entry.studentId,
                    payoutStatus: "PAID"
                },
                orderBy: { paidAt: "desc" }
            })
            if (lastPaid) {
                supervisedHoursActual ??= lastPaid.supervisedHoursActual ? Number(lastPaid.supervisedHoursActual) : null
                individualHoursDelta ??= lastPaid.individualHoursDelta ? Number(lastPaid.individualHoursDelta) : null
            }
        }

        const now = new Date()

        // 3. Mark entry as PAID with manual data
        await (prisma as any).supervisorLedgerEntry.update({
            where: { id: data.ledgerEntryId },
            data: {
                payoutStatus: "PAID",
                supervisedHoursActual,
                individualHoursDelta,
                paymentMethod: data.paymentMethod,
                paymentReference: data.paymentReference || null,
                paymentNotes: data.paymentNotes || null,
                paidAt: now
            }
        })

        // 4. Create SupervisorPayout transaction record (audit trail)
        await (prisma as any).supervisorPayout.create({
            data: {
                invoiceId: entry.invoiceId,
                supervisorId: entry.supervisorId,
                amount: data.amount,
                method: data.paymentMethod,
                reference: data.paymentReference || null,
                notes: data.paymentNotes || null
            }
        })

        await logAudit({
            action: "CREATE",
            entity: "SupervisorPayout",
            entityId: data.ledgerEntryId,
            details: `Supervisor paid $${data.amount} via ${data.paymentMethod}. Hours supervised: ${supervisedHoursActual ?? "N/A"}`
        })

        revalidatePath("/office/payments")
        return { success: true }
    } catch (error: any) {
        console.error("payToSupervisorFromLedger error:", error)
        return { error: error.message }
    }
}
