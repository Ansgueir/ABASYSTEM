import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

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
        
        const selectedStudent = searchParams.get("student") || ""
        const selectedSupervisor = searchParams.get("supervisor") || ""
        const monthParam = searchParams.get("month")
        const yearParam = searchParams.get("year")

        // 1. Robust Filter Logic
        const supervisionWhere: any = { status: statusFilter as any }
        const independentWhere: any = { status: statusFilter as any }

        // Date Period Filtering with robust validation
        const currentYear = new Date().getFullYear()
        const year = (yearParam && !isNaN(parseInt(yearParam))) ? parseInt(yearParam) : currentYear
        
        let startDate: Date
        let endDate: Date

        if (monthParam && !isNaN(parseInt(monthParam))) {
            // Specific Month
            const month = parseInt(monthParam)
            startDate = new Date(year, month, 1)
            endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)
        } else {
            // Full Year
            startDate = new Date(year, 0, 1)
            endDate = new Date(year, 11, 31, 23, 59, 59, 999)
        }

        supervisionWhere.date = { gte: startDate, lte: endDate }
        independentWhere.date = { gte: startDate, lte: endDate }

        if (selectedStudent && selectedStudent !== "undefined") {
            const studentFilter = { fullName: { equals: selectedStudent, mode: 'insensitive' as any } }
            supervisionWhere.student = studentFilter
            independentWhere.student = studentFilter
        }
        
        if (selectedSupervisor && selectedSupervisor !== "undefined") {
            supervisionWhere.supervisor = { fullName: { equals: selectedSupervisor, mode: 'insensitive' as any } }
        }

        // 2. Fetch Data
        const [supervisionLogs, independentLogs] = await Promise.all([
            prisma.supervisionHour.findMany({
                where: supervisionWhere,
                orderBy: { date: 'asc' },
                include: { student: { select: { fullName: true } }, supervisor: { select: { fullName: true } } }
            }),
            prisma.independentHour.findMany({
                where: independentWhere,
                orderBy: { date: 'asc' },
                include: { student: { select: { fullName: true } } }
            })
        ])

        // 3. Flatten Data for Excel
        const combinedData = [
            ...supervisionLogs.map(l => ({
                Date: format(new Date(l.date), 'yyyy-MM-dd'),
                Time: format(new Date(l.startTime), 'h:mm a'),
                Supervisor: l.supervisor?.fullName || 'N/A',
                Student: l.student?.fullName || 'N/A',
                Type: 'SUPERVISED',
                'Supervision Type': l.supervisionType,
                'Activity Format': l.activityType,
                Setting: l.setting.replace('_', ' '),
                Hours: Number(l.hours),
                Notes: l.notes || '',
                Status: l.status
            })),
            ...(selectedSupervisor ? [] : independentLogs.map(l => ({
                Date: format(new Date(l.date), 'yyyy-MM-dd'),
                Time: format(new Date(l.startTime), 'h:mm a'),
                Supervisor: 'N/A (Independent)',
                Student: l.student?.fullName || 'N/A',
                Type: 'INDEPENDENT',
                'Supervision Type': 'N/A',
                'Activity Format': 'N/A',
                Setting: 'Self-Study/Other',
                Hours: Number(l.hours),
                Notes: l.notes || '',
                Status: l.status
            })))
        ]

        // 4. Create Workbook
        const worksheet = XLSX.utils.json_to_sheet(combinedData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Supervision Logs")

        // 5. Generate Buffer
        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

        // 6. Return Response
        const fileName = `Logs_${statusFilter}_${format(new Date(), 'yyyyMMdd')}.xlsx`
        
        return new NextResponse(buffer, {
            headers: {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
        })

    } catch (error: any) {
        console.error("Excel Export error:", error)
        return new NextResponse(error.message, { status: 500 })
    }
}
