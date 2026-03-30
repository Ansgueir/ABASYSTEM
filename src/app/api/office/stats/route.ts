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
            pendingInvoices
        ] = await Promise.all([
            prisma.student.count({ where: { user: { isHidden: false } } }),
            prisma.supervisor.count({ where: { user: { isHidden: false } } }),
            prisma.invoice.count({ where: { status: 'SENT' } })
        ])

        const stats: any = {
            totalStudents: studentCount,
            totalSupervisors: supervisorCount,
            pendingPayments: pendingInvoices,
            activeStudents: studentCount
        }

        return NextResponse.json(stats, { status: 200 })
    } catch (error) {
        console.error("Error fetching office stats:", error)
        return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
    }
}
