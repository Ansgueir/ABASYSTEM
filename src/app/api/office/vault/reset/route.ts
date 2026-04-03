import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"

export async function POST() {
    // ── API FIREWALL ─────────────────────────────────────────────
    const session = await auth()
    if (!session?.user?.email || session.user.email.toLowerCase().trim() !== QA_SUPER_EMAIL) {
        return NextResponse.json({ error: "403 Forbidden" }, { status: 403 })
    }

    try {
        // ── ATOMIC TRANSACTION ────────────────────────────────────
        await prisma.$transaction([
            (prisma as any).supervisorPayout.deleteMany({}),
            (prisma as any).supervisorLedgerEntry.deleteMany({}),
            (prisma as any).studentPayment.deleteMany({}),
            prisma.invoice.updateMany({
                data: {
                    status: "READY_TO_GO" as any,
                    amountPaid: 0
                }
            })
        ])

        return NextResponse.json({
            success: true,
            message: "Data reset completed. All invoices reverted to READY_TO_GO. Payment records cleared."
        })
    } catch (error: any) {
        console.error("[VAULT RESET ERROR]", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
