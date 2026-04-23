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

        const groups = await (prisma as any).officeGroup.findMany({
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

        students.forEach((s: any) => {
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

        supervisors.forEach((sup: any) => {
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

        // ── 4. SHEET: PLANS & OPTIONS (CONFIGURACIÓN TOTAL) ──────────────────
        const sheetPlans = workbook.addWorksheet('Plans & Options')
        sheetPlans.columns = [
            { header: 'PLAN NAME', key: 'name', width: 25 },
            { header: 'FIELDWORK TYPE', key: 'type', width: 15 },
            { header: 'TOTAL HOURS', key: 'totalHours', width: 15 },
            { header: 'HOURS/MONTH', key: 'hoursPerMonth', width: 15 },
            { header: 'SUPERVISED %', key: 'supPct', width: 15 },
            { header: 'HOURLY RATE', key: 'rate', width: 15 },
            { header: 'ENROLLMENT FEE', key: 'fee', width: 15 },
            { header: 'SUP COMMISSION %', key: 'comm', width: 15 },
            { header: 'DURATION (MONTHS)', key: 'months', width: 15 },
            { header: 'TOTAL SUP HOURS', key: 'amtHours', width: 15 },
            { header: 'TOTAL PLAN COST', key: 'totalCost', width: 15 },
            { header: 'MONTHLY PAYMENT', key: 'monthly', width: 15 },
        ]
        sheetPlans.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetPlans.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }

        plans.forEach((p: any) => {
            const row = sheetPlans.addRow({
                name: p.name,
                type: p.fieldworkType,
                totalHours: p.totalHours,
                hoursPerMonth: p.hoursPerMonth,
                supPct: `${((Number(p.supervisedPercentage) || 0) * 100).toFixed(1)}%`,
                rate: Number(p.hourlyRate || 0),
                fee: Number(p.enrollmentFee || 0),
                comm: `${((Number(p.supervisorCommission) || 0.54) * 100).toFixed(0)}%`,
                months: p.numberOfMonths,
                amtHours: Number(p.amountSupHours || 0),
                totalCost: Number(p.totalCost || 0),
                monthly: Number(p.monthlyPayment || 0)
            })
            const moneyCols = ['rate', 'fee', 'totalCost', 'monthly']
            moneyCols.forEach(col => row.getCell(col).numFmt = '"$"#,##0.00')
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
        groups.forEach((g: any) => {
            sheetGroups.addRow({
                name: g.name,
                type: g.groupType,
                day: g.dayOfWeek,
                time: `${g.startTime} - ${g.endTime}`,
                sups: g.supervisors.map((s: any) => s.supervisor?.fullName).join(", ")
            })
        })

        // ── 6. SHEET: MASTER FINANCIAL AUDIT (WATERFALL ENGINE) ───────────────
        const sheetLedger = workbook.addWorksheet('Waterfall Audit')
        sheetLedger.columns = [
            { header: 'TX DATE', key: 'date', width: 15 },
            { header: 'STUDENT', key: 'student', width: 25 },
            { header: 'SUPERVISOR', key: 'supervisor', width: 25 },
            { header: 'INVOICE REF', key: 'invRef', width: 15 },
            { header: 'REVENUE COLLECTED', key: 'collected', width: 18 },
            { header: 'SUPERVISOR SHARE', key: 'supShare', width: 18 },
            { header: 'OFFICE NET REVENUE', key: 'officeShare', width: 18 },
            { header: 'SUP CAP FOR PERIOD', key: 'cap', width: 18 },
            { header: 'SUP REMAINING BAL', key: 'rem', width: 18 },
            { header: 'PAYOUT STATUS', key: 'status', width: 15 },
            { header: 'LIQUIDATION REF', key: 'ref', width: 20 },
        ]
        sheetLedger.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetLedger.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }

        ledgerEntries.forEach((e: any) => {
            const row = sheetLedger.addRow({
                date: format(new Date(e.createdAt), 'yyyy-MM-dd'),
                student: e.student.fullName,
                supervisor: e.supervisor.fullName,
                invRef: e.invoiceId.slice(-8).toUpperCase(),
                collected: Number(e.paymentFromStudent || 0),
                supShare: Number(e.supervisorPayout || 0),
                officeShare: Number(e.officePayout || 0),
                cap: Number(e.supervisorCapTotal || 0),
                rem: Number(e.supervisorCapRemainingAfter || 0),
                status: e.payoutStatus,
                ref: e.paymentReference || "-"
            })
            const moneyCols = ['collected', 'supShare', 'officeShare', 'cap', 'rem']
            moneyCols.forEach(col => row.getCell(col).numFmt = '"$"#,##0.00')
        })

        // ── 7. SHEET: BILLING & COLLECTIONS (AUDIT) ──────────────────────────
        const sheetInv = workbook.addWorksheet('Billing Details')
        sheetInv.columns = [
            { header: 'BILL DATE', key: 'date', width: 15 },
            { header: 'STUDENT', key: 'student', width: 25 },
            { header: 'INVOICE ID', key: 'id', width: 15 },
            { header: 'AMOUNT DUE', key: 'due', width: 15 },
            { header: 'AMOUNT PAID', key: 'paid', width: 15 },
            { header: 'BALANCE OWE', key: 'owe', width: 15 },
            { header: 'STATUS', key: 'status', width: 15 },
        ]
        sheetInv.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetInv.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }

        allInvoices.forEach((inv: any) => {
            const due = Number(inv.amountDue || 0)
            const paid = Number(inv.amountPaid || 0)
            const row = sheetInv.addRow({
                date: inv.invoiceDate ? format(new Date(inv.invoiceDate), 'yyyy-MM-dd') : "-",
                student: inv.student.fullName,
                id: inv.id.slice(-8).toUpperCase(),
                due: due,
                paid: paid,
                owe: due - paid,
                status: inv.status
            })
            const moneyCols = ['due', 'paid', 'owe']
            moneyCols.forEach(col => row.getCell(col).numFmt = '"$"#,##0.00')
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
