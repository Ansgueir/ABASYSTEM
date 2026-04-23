import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from 'exceljs'
import { format } from "date-fns"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const role = String((session.user as any).role).toLowerCase()
        const officeRole = String((session.user as any).officeRole).toUpperCase()

        if (role !== "qa" && officeRole !== "SUPER_ADMIN") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const startPeriod = parseInt(searchParams.get('startPeriod') || '1')
        const endPeriod = parseInt(searchParams.get('endPeriod') || '48')

        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'ABA Supervision System'
        workbook.created = new Date()

        // ── 0. DATA FETCHING ──────────────────────────────────────────────────
        const students: any[] = await (prisma as any).student.findMany({
            include: {
                supervisor: true,
                financialPeriods: { orderBy: { periodNumber: 'asc' } },
                payments: true,
                invoices: true,
                user: true
            }
        })

        const supervisors: any[] = await (prisma as any).supervisor.findMany({
            include: {
                students: true,
                user: true
            }
        })

        const officeMembers = await (prisma as any).officeMember.findMany({
            include: { user: true }
        })

        const plans = await prisma.plan.findMany()

        const groups = await prisma.supervisionGroup.findMany({
            include: { supervisors: { include: { supervisor: true } } }
        })

        const allStudentPayments: any[] = await (prisma as any).studentPayment.findMany({
            include: { student: { include: { supervisor: true } } },
            orderBy: { paymentDate: 'asc' }
        })

        const allInvoices = await prisma.invoice.findMany({
            include: { student: true },
            orderBy: { createdAt: "desc" }
        })

        const ledgerEntries = await (prisma as any).supervisorLedgerEntry.findMany({
            include: { student: true, supervisor: true },
            orderBy: { createdAt: "desc" }
        })

        // ── 1. SHEET: STUDENTS (FULL PROFILE) ──────────────────────────────────
        const sheetStudents = workbook.addWorksheet('Students')
        sheetStudents.columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'FULL NAME', key: 'name', width: 30 },
            { header: 'EMAIL', key: 'email', width: 30 },
            { header: 'PHONE', key: 'phone', width: 15 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'CREDENTIAL', key: 'credential', width: 15 },
            { header: 'STATUS', key: 'status', width: 15 },
            { header: 'SUPERVISOR', key: 'supervisor', width: 30 },
            { header: 'PLAN', key: 'plan', width: 20 },
            { header: 'START DATE', key: 'startDate', width: 15 },
            { header: 'END DATE', key: 'endDate', width: 15 },
            { header: 'CITY', key: 'city', width: 15 },
            { header: 'STATE', key: 'state', width: 10 },
            { header: 'SCHOOL', key: 'school', width: 20 },
        ]
        sheetStudents.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetStudents.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }

        students.forEach(s => {
            sheetStudents.addRow({
                id: s.id,
                name: s.fullName,
                email: s.user?.email || s.email,
                phone: s.phone,
                bacbId: s.bacbId,
                credential: s.credential,
                status: s.status,
                supervisor: s.supervisor?.fullName || "Unassigned",
                plan: s.assignedOptionPlan,
                startDate: s.startDate ? format(new Date(s.startDate), 'yyyy-MM-dd') : "-",
                endDate: s.endDate ? format(new Date(s.endDate), 'yyyy-MM-dd') : "-",
                city: s.city,
                state: s.state,
                school: s.school
            })
        })

        // ── 2. SHEET: SUPERVISORS (FULL PROFILE) ────────────────────────────────
        const sheetSupervisors = workbook.addWorksheet('Supervisors')
        sheetSupervisors.columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'FULL NAME', key: 'name', width: 30 },
            { header: 'EMAIL', key: 'email', width: 30 },
            { header: 'PHONE', key: 'phone', width: 15 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'CREDENTIAL', key: 'credential', width: 15 },
            { header: 'STATUS', key: 'status', width: 15 },
            { header: 'PAY PERCENTAGE', key: 'payRate', width: 15 },
            { header: 'ADDRESS', key: 'address', width: 30 },
        ]
        sheetSupervisors.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetSupervisors.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }

        supervisors.forEach(sup => {
            sheetSupervisors.addRow({
                id: sup.id,
                name: sup.fullName,
                email: sup.user?.email || sup.email,
                phone: sup.phone,
                bacbId: sup.bacbId,
                credential: sup.credentialType,
                status: sup.status,
                payRate: `${((sup.paymentPercentage || 0.54) * 100).toFixed(0)}%`,
                address: sup.address
            })
        })

        // ── 3. SHEET: OFFICE TEAM ─────────────────────────────────────────────
        const sheetOffice = workbook.addWorksheet('Office Team')
        sheetOffice.columns = [
            { header: 'NAME', key: 'name', width: 30 },
            { header: 'EMAIL', key: 'email', width: 30 },
            { header: 'ROLE', key: 'role', width: 20 },
            { header: 'STATUS', key: 'status', width: 15 },
        ]
        sheetOffice.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetOffice.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }

        officeMembers.forEach((m: any) => {
            sheetOffice.addRow({
                name: m.fullName,
                email: m.user?.email,
                role: m.officeRole,
                status: m.user?.isActive ? "ACTIVE" : "INACTIVE"
            })
        })

        // ── 4. SHEET: PLANS & OPTIONS ─────────────────────────────────────────
        const sheetPlans = workbook.addWorksheet('Plans & Options')
        sheetPlans.columns = [
            { header: 'PLAN NAME', key: 'name', width: 30 },
            { header: 'TOTAL COST', key: 'cost', width: 15 },
            { header: 'MONTHLY PMT', key: 'monthly', width: 15 },
            { header: 'TOTAL HOURS', key: 'hours', width: 15 },
            { header: 'SUP COMMISSION', key: 'commission', width: 15 },
        ]
        sheetPlans.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetPlans.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }

        plans.forEach(p => {
            const row = sheetPlans.addRow({
                name: p.name,
                cost: Number(p.totalCost || 0),
                monthly: Number(p.monthlyPayment || 0),
                hours: Number(p.totalHours || 0),
                commission: `${((Number(p.supervisorCommission) || 0.54) * 100).toFixed(0)}%`
            })
            row.getCell('cost').numFmt = '"$"#,##0.00'
            row.getCell('monthly').numFmt = '"$"#,##0.00'
        })

        // ── 5. SHEET: SUPERVISION GROUPS ──────────────────────────────────────
        const sheetGroups = workbook.addWorksheet('Supervision Groups')
        sheetGroups.columns = [
            { header: 'GROUP NAME', key: 'name', width: 30 },
            { header: 'TYPE', key: 'type', width: 15 },
            { header: 'DAY', key: 'day', width: 15 },
            { header: 'TIME', key: 'time', width: 20 },
            { header: 'SUPERVISORS', key: 'sups', width: 40 },
        ]
        sheetGroups.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetGroups.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } }

        groups.forEach(g => {
            sheetGroups.addRow({
                name: g.name,
                type: g.groupType,
                day: g.dayOfWeek,
                time: `${g.startTime} - ${g.endTime}`,
                sups: g.supervisors.map((s: any) => s.supervisor?.fullName).join(", ")
            })
        })

        // ── 6. SHEET: MASTER FINANCIAL LEDGER (WATERFALL) ─────────────────────
        const sheetLedger = workbook.addWorksheet('Financial Ledger (Waterfall)')
        sheetLedger.columns = [
            { header: 'DATE', key: 'date', width: 15 },
            { header: 'STUDENT', key: 'student', width: 30 },
            { header: 'SUPERVISOR', key: 'supervisor', width: 30 },
            { header: 'STUDENT PAID', key: 'collected', width: 15 },
            { header: 'SUP SHARE', key: 'supShare', width: 15 },
            { header: 'OFFICE NET', key: 'officeShare', width: 15 },
            { header: 'STATUS', key: 'status', width: 15 },
        ]
        sheetLedger.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetLedger.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }

        ledgerEntries.forEach((e: any) => {
            const row = sheetLedger.addRow({
                date: format(new Date(e.createdAt), 'yyyy-MM-dd'),
                student: e.student.fullName,
                supervisor: e.supervisor.fullName,
                collected: Number(e.paymentFromStudent || 0),
                supShare: Number(e.supervisorPayout || 0),
                officeShare: Number(e.officePayout || 0),
                status: e.payoutStatus
            })
            row.getCell('collected').numFmt = '"$"#,##0.00'
            row.getCell('supShare').numFmt = '"$"#,##0.00'
            row.getCell('officeShare').numFmt = '"$"#,##0.00'
        })

        // ── 7. SHEET: ALL INVOICES (COBROS) ──────────────────────────────────
        const sheetInv = workbook.addWorksheet('All Invoices')
        sheetInv.columns = [
            { header: 'DATE', key: 'date', width: 15 },
            { header: 'STUDENT', key: 'student', width: 30 },
            { header: 'AMOUNT DUE', key: 'due', width: 15 },
            { header: 'AMOUNT PAID', key: 'paid', width: 15 },
            { header: 'STATUS', key: 'status', width: 15 },
        ]
        sheetInv.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetInv.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }

        allInvoices.forEach(inv => {
            const row = sheetInv.addRow({
                date: inv.invoiceDate ? format(new Date(inv.invoiceDate), 'yyyy-MM-dd') : "-",
                student: inv.student.fullName,
                due: Number(inv.amountDue || 0),
                paid: Number(inv.amountPaid || 0),
                status: inv.status
            })
            row.getCell('due').numFmt = '"$"#,##0.00'
            row.getCell('paid').numFmt = '"$"#,##0.00'
        })

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            headers: {
                'Content-Disposition': `attachment; filename="MASTER_DATABASE_AUDIT_${format(new Date(), 'yyyyMMdd')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        })

    } catch (error) {
        console.error("Master Export Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
