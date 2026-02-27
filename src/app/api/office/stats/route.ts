import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { startOfMonth } from "date-fns"

export async function GET() {
    const session = await auth()
    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") {
        return NextResponse.json({ error: "Unauthorized role" }, { status: 403 })
    }

    try {
        const startOfCurrentMonth = startOfMonth(new Date())

        const [
            studentCount,
            supervisorCount,
            pendingInvoices,
            paidInvoicesAgg
        ] = await Promise.all([
            prisma.student.count(),
            prisma.supervisor.count(),
            prisma.invoice.count({ where: { status: 'SENT' } }), // Pending invoices
            prisma.invoice.aggregate({
                where: {
                    status: 'PAID',
                    // Assuming they want to filter by the current month. If they want all time 'Paid out', remove the date constraint.
                    // "sumar el total de facturas marcadas como PAID en el mes en curso."
                    createdAt: { gte: startOfCurrentMonth }
                },
                _sum: { amountPaid: true }
            })
        ])

        const stats = {
            totalStudents: studentCount,
            totalSupervisors: supervisorCount,
            pendingPayments: pendingInvoices,
            totalPaidOut: Number(paidInvoicesAgg._sum?.amountPaid || 0),
            activeStudents: studentCount
        }

        return NextResponse.json(stats, { status: 200 })
    } catch (error) {
        console.error("Error fetching office stats:", error)
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
    }
}
