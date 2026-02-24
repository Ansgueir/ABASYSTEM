import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        const role = String((session.user as any).role).toLowerCase()
        if (role !== "office" && role !== "qa") return new NextResponse("Unauthorized", { status: 401 })

        const { searchParams } = new URL(request.url)
        const statusStr = searchParams.get("status") || "PENDING"
        const validStatuses = ["PENDING", "APPROVED", "REJECTED", "BILLED"]
        const statusFilter = validStatuses.includes(statusStr.toUpperCase()) ? statusStr.toUpperCase() : "PENDING"

        const logs = await prisma.supervisionHour.findMany({
            where: { status: statusFilter as any },
            include: { student: true, supervisor: true },
            orderBy: { date: 'desc' }
        })

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Supervision Logs Export</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 40px; }
                .header { text-align: center; margin-bottom: 40px; }
                .header h1 { margin: 0; color: #111; }
                .header p { color: #666; margin-top: 5px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
                th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8f9fa; font-weight: 600; color: #444; }
                .amount { text-align: right; }
                .status-badge { padding: 2px 8px; border-radius: 999px; font-weight: 500; font-size: 11px; }
                .status-pending { color: #F59E0B; background: #F59E0B1A; }
                .status-approved { color: #3B82F6; background: #3B82F61A; }
                .status-rejected { color: #EF4444; background: #EF44441A; }
                .status-billed { color: #10B981; background: #10B9811A; }
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
                <h1>Supervision Logs: ${statusFilter}</h1>
                <p>Generated: ${format(new Date(), 'MMMM d, yyyy')}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Supervisor</th>
                        <th>Student</th>
                        <th>Activity (Format) / Setting</th>
                        <th>Notes / Topic</th>
                        <th class="amount">Hours</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${logs.length > 0 ? logs.map(log => {
            const dateStr = format(new Date(log.date), 'MMM d, yyyy')
            const timeStr = new Date(log.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            let badgeClass = 'status-pending'
            if (log.status === 'APPROVED') badgeClass = 'status-approved'
            if (log.status === 'REJECTED') badgeClass = 'status-rejected'
            if (log.status === 'BILLED' || (log.status as string) === 'PAID') badgeClass = 'status-billed'

            return `
                        <tr>
                            <td><strong>${dateStr}</strong><br/><span style="color:#666;font-size:11px">${timeStr}</span></td>
                            <td>${log.supervisor?.fullName || 'N/A'}</td>
                            <td>${log.student?.fullName || 'N/A'}</td>
                            <td><strong>${log.activityType} (${log.supervisionType})</strong><br/><span style="color:#666;font-size:11px">${log.setting.replace('_', ' ')}</span></td>
                            <td><i style="color:#555">"${log.notes || 'No notes'}"</i>${log.groupTopic ? `<br/><b>Topic:</b> ${log.groupTopic}` : ''}</td>
                            <td class="amount"><strong>${Number(log.hours).toFixed(1)}h</strong></td>
                            <td>
                                <span class="status-badge ${badgeClass}">
                                    ${log.status}
                                </span>
                            </td>
                        </tr>
                        `;
        }).join('') : `<tr><td colspan="7" style="text-align: center; padding: 20px;">No ${statusFilter.toLowerCase()} logs found.</td></tr>`}
                </tbody>
            </table>
        </body>
        </html>
        `

        return new NextResponse(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        })

    } catch (error: any) {
        console.error("Export error:", error)
        return new NextResponse(error.message, { status: 500 })
    }
}
