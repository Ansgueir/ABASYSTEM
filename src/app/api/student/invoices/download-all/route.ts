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

        // Generate HTML
        const htmlRows = invoices.map(inv => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #ddd; font-family: monospace;">#${inv.id.slice(-6).toUpperCase()}</td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd;">${inv.invoiceDate.toISOString().split('T')[0]}</td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd;">
                    <span style="padding: 4px 8px; border-radius: 9999px; font-size: 12px; font-weight: bold; background-color: ${inv.status === 'PAID' ? '#dcfce7' : '#fef08a'}; color: ${inv.status === 'PAID' ? '#166534' : '#854d0e'};">
                        ${inv.status}
                    </span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(inv.amountDue).toFixed(2)}</td>
                <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">$${Number(inv.amountPaid).toFixed(2)}</td>
            </tr>
        `).join('')

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoices - ${student.fullName}</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #333; }
                .container { max-width: 800px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 24px; border-radius: 12px; border: 1px solid #eaeaea; }
                h1 { margin-top: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
                th { background-color: #f8f9fa; padding: 12px; border-bottom: 2px solid #ddd; }
                .actions { margin-top: 20px; text-align: right; }
                button { background-color: #6366f1; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; }
                button:hover { background-color: #4f46e5; }
                @media print { .actions { display: none; } .container { box-shadow: none; border: none; padding: 0; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Billing History & Invoices</h1>
                    <p><strong>Student:</strong> ${student.fullName}</p>
                    <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Invoice ID</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th style="text-align: right;">Amount Due</th>
                            <th style="text-align: right;">Amount Paid</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${htmlRows}
                    </tbody>
                </table>
                
                <div class="actions">
                    <button onclick="window.print()">Print / Save as PDF</button>
                    <button onclick="window.close()" style="background-color: #e5e7eb; color: #374151; margin-left: 10px;">Close</button>
                </div>
            </div>
        </body>
        </html>
        `;

        return new NextResponse(htmlContent, {
            status: 200,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            }
        })

    } catch (error) {
        console.error("Error generating invoices CSV:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
