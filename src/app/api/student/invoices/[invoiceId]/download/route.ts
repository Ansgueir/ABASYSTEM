import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ invoiceId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const role = String((session.user as any).role).toLowerCase()
        if (role !== "student" && role !== "qa") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { invoiceId } = await params;

        const student = await prisma.student.findUnique({
            where: { userId: session.user.id }
        })

        if (!student) {
            return new NextResponse("Student not found", { status: 404 })
        }

        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                student: true
            }
        })

        if (!invoice || invoice.studentId !== student.id) {
            return new NextResponse("Invoice not found", { status: 404 })
        }

        // Generate HTML
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invoice - ${invoice.student.fullName}</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #333; }
                .container { max-width: 800px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 40px; border-radius: 12px; border: 1px solid #eaeaea; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                h1 { margin: 0 0 10px 0; color: #111; font-size: 28px; }
                .status { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-size: 14px; font-weight: bold; background-color: ${invoice.status === 'PAID' ? '#dcfce7' : '#fef08a'}; color: ${invoice.status === 'PAID' ? '#166534' : '#854d0e'}; }
                .details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
                .details-box { background: #f8f9fa; padding: 20px; border-radius: 8px; }
                .details h3 { margin-top: 0; color: #555; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
                .details p { margin: 5px 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; text-align: left; }
                th { background-color: #f8f9fa; padding: 15px; border-bottom: 2px solid #ddd; color: #555; }
                td { padding: 15px; border-bottom: 1px solid #ddd; }
                .totals { margin-top: 40px; display: flex; justify-content: flex-end; }
                .totals-box { width: 300px; }
                .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .totals-row.grand-total { font-size: 20px; font-weight: bold; border-bottom: none; border-top: 2px solid #333; margin-top: 10px; padding-top: 15px; }
                .actions { margin-top: 40px; text-align: center; }
                button { background-color: #6366f1; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: background 0.2s; }
                button:hover { background-color: #4f46e5; }
                @media print { .actions { display: none; } .container { box-shadow: none; border: none; padding: 0; } body { padding: 0; } }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div>
                        <h1>INVOICE #<span style="color:#666">${invoice.id.slice(-6).toUpperCase()}</span></h1>
                        <p style="color: #666; margin: 0;">Date: ${invoice.invoiceDate.toISOString().split('T')[0]}</p>
                    </div>
                    <div>
                        <span class="status">${invoice.status}</span>
                    </div>
                </div>
                
                <div class="details">
                    <div class="details-box">
                        <h3>Billed To</h3>
                        <p><strong>${invoice.student.fullName}</strong></p>
                        <p>${invoice.student.email}</p>
                    </div>
                    <div class="details-box">
                        <h3>Payment Info</h3>
                        <p><strong>Status:</strong> ${invoice.status}</p>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>ABA Supervision Services</td>
                            <td style="text-align: right;">$${Number(invoice.amountDue).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="totals-box">
                        <div class="totals-row">
                            <span>Subtotal</span>
                            <span>$${Number(invoice.amountDue).toFixed(2)}</span>
                        </div>
                        <div class="totals-row">
                            <span>Amount Paid</span>
                            <span>-$${Number(invoice.amountPaid).toFixed(2)}</span>
                        </div>
                        <div class="totals-row grand-total">
                            <span>Balance Due</span>
                            <span>$${(Number(invoice.amountDue) - Number(invoice.amountPaid)).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

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
        console.error("Error generating invoice HTML:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
