import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { NextResponse } from "next/server"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const role = String((session.user as any).role).toLowerCase()
        if (role !== "supervisor" && role !== "qa") return new NextResponse("Unauthorized", { status: 401 })

        const supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id }
        })

        if (!supervisor) return new NextResponse("Supervisor not found", { status: 404 })

        const payments = await prisma.supervisorPayment.findMany({
            where: { supervisorId: supervisor.id },
            include: { student: true },
            orderBy: { createdAt: 'desc' }
        })

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Supervisor Payments Export</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 40px; }
                .header { text-align: center; margin-bottom: 40px; }
                .header h1 { margin: 0; color: #111; }
                .header p { color: #666; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f9fa; font-weight: 600; color: #444; }
                .amount { text-align: right; }
                .status-paid { color: #10B981; font-weight: 500; font-size: 12px; padding: 2px 8px; background: #10B9811A; border-radius: 999px; }
                .status-pending { color: #F59E0B; font-weight: 500; font-size: 12px; padding: 2px 8px; background: #F59E0B1A; border-radius: 999px; }
                @media print {
                    body { padding: 0; margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="no-print" style="margin-bottom: 20px; text-align: right;">
                <button onclick="window.print()" style="padding: 8px 16px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Print / Save PDF</button>
            </div>
            
            <div class="header">
                <h1>Payment Statement</h1>
                <p>Supervisor: ${supervisor.fullName || 'Supervisor'}</p>
                <p>Generated: ${format(new Date(), 'MMMM d, yyyy')}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Student</th>
                        <th class="amount">Generated ($)</th>
                        <th class="amount">Paid ($)</th>
                        <th class="amount">Balance ($)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${payments.length > 0 ? payments.map(p => {
            const isPaid = Number(p.balanceDue) <= 0;
            return `
                        <tr>
                            <td><strong>${format(new Date(p.monthYear), 'MMMM yyyy')}</strong></td>
                            <td>${p.student?.fullName || 'Unknown'}</td>
                            <td class="amount">$${Number(p.amountDue).toFixed(2)}</td>
                            <td class="amount">$${(Number(p.amountAlreadyPaid) + Number(p.amountPaidThisMonth)).toFixed(2)}</td>
                            <td class="amount"><strong>$${Number(p.balanceDue).toFixed(2)}</strong></td>
                            <td>
                                <span class="${isPaid ? 'status-paid' : 'status-pending'}">
                                    ${isPaid ? 'PAID' : 'PENDING'}
                                </span>
                            </td>
                        </tr>
                        `;
        }).join('') : '<tr><td colspan="6" style="text-align: center; padding: 20px;">No payments found.</td></tr>'}
                </tbody>
            </table>
        </body>
        </html>
        `

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html',
            },
        })

    } catch (error: any) {
        console.error("Export error:", error)
        return new NextResponse(error.message, { status: 500 })
    }
}
