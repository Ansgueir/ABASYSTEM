import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const role = String((session.user as any).role).toLowerCase()
        if (role !== "student" && role !== "qa") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id }
        })

        if (!student) {
            return new NextResponse("Student not found", { status: 404 })
        }

        const invoices = await prisma.invoice.findMany({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' }
        })

        if (invoices.length === 0) {
            return new NextResponse("No invoices found", { status: 404 })
        }

        // Generate CSV
        const headers = ["Invoice ID", "Date", "Status", "Amount Due", "Amount Paid"]
        const csvRows = [headers.join(",")]

        for (const inv of invoices) {
            csvRows.push([
                inv.id,
                inv.invoiceDate.toISOString().split('T')[0],
                inv.status,
                Number(inv.amountDue).toFixed(2),
                Number(inv.amountPaid).toFixed(2)
            ].join(","))
        }

        const csvContent = csvRows.join("\n")

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="invoices_${student.fullName.replace(/\s+/g, '_')}.csv"`,
            }
        })

    } catch (error) {
        console.error("Error generating invoices CSV:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
