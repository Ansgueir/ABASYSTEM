import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

export async function POST() {
    // ── API FIREWALL — solo qa-super@abasystem.com ──────────────────
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        // Orden correcto respetando FK constraints:
        // hijos primero, padres después

        // 1. Asistencia a sesiones grupales
        await (prisma as any).groupSupervisionAttendance.deleteMany({})

        // 2. Sesiones de supervisión grupal
        await (prisma as any).groupSupervisionSession.deleteMany({})

        // 3. Ledger waterfall del supervisor
        await (prisma as any).supervisorLedgerEntry.deleteMany({})

        // 4. Pagos realizados al supervisor
        await (prisma as any).supervisorPayout.deleteMany({})

        // 5. Horas de supervisión (todas: PENDING, APPROVED, BILLED, REJECTED)
        await prisma.supervisionHour.deleteMany({})

        // 6. Horas independientes
        await prisma.independentHour.deleteMany({})

        // 7. Facturas (después de horas para evitar FK)
        await prisma.invoice.deleteMany({})

        // 8. Pagos de estudiantes
        await (prisma as any).studentPayment.deleteMany({})

        // 9. Tarjetas de pago supervisor (legacy)
        await (prisma as any).supervisorPayment.deleteMany({})

        // 10. Evaluaciones de estudiantes
        await (prisma as any).studentEvaluation.deleteMany({})

        // 11. Horarios repetitivos
        await (prisma as any).repeatingSchedule.deleteMany({})

        // 12. Logs de importación
        await (prisma as any).importLog.deleteMany({})
        await (prisma as any).importBatch.deleteMany({})

        // 13. Auditoría y notificaciones
        await (prisma as any).auditLog.deleteMany({})
        await prisma.notification.deleteMany({})

        return NextResponse.json({
            success: true,
            message: "Clean slate complete. All activity records deleted. Users, plans, students, supervisors and documents are intact."
        })
    } catch (error: any) {
        console.error("[VAULT RESET ERROR]", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
