import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

export async function GET(req: NextRequest) {
    const session = await auth()
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

    const role = String((session.user as any).role).toLowerCase()
    const officeRole = (session.user as any).officeRole
    if (role !== "office" && role !== "qa") return new NextResponse("Unauthorized", { status: 401 })
    if (officeRole !== "SUPER_ADMIN") return new NextResponse("Forbidden", { status: 403 })

    try {
        const workbook = new ExcelJS.Workbook()
        workbook.creator = "ABA Supervision System"
        workbook.lastModifiedBy = "ABA Supervision System"
        workbook.created = new Date()

        // ── 1. SHEET: INVOICES (COLLECTIONS) ──────────────────────────────────
        const sheetInvoices = workbook.addWorksheet("Invoices (Cobros)")
        sheetInvoices.columns = [
            { header: "INVOICE #", key: "invoiceId", width: 15 },
            { header: "DATE", key: "date", width: 15 },
            { header: "STUDENT", key: "studentName", width: 30 },
            { header: "SUPERVISOR", key: "supervisorName", width: 30 },
            { header: "AMOUNT DUE", key: "amountDue", width: 15 },
            { header: "AMOUNT PAID", key: "amountPaid", width: 15 },
            { header: "BALANCE", key: "balance", width: 15 },
            { header: "STATUS", key: "status", width: 15 },
        ]

        const invoices = await prisma.invoice.findMany({
            include: {
                student: { include: { supervisor: true } }
            },
            orderBy: { createdAt: "desc" }
        })

        invoices.forEach(inv => {
            const due = Number(inv.amountDue || 0)
            const paid = Number(inv.amountPaid || 0)
            sheetInvoices.addRow({
                invoiceId: inv.id.slice(-8).toUpperCase(),
                date: inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : "-",
                studentName: inv.student.fullName,
                supervisorName: inv.student.supervisor?.fullName || "Unassigned",
                amountDue: due,
                amountPaid: paid,
                balance: due - paid,
                status: inv.status
            })
        })

        // ── 2. SHEET: STUDENT PAYMENTS (REVENUE) ──────────────────────────────
        const sheetPayments = workbook.addWorksheet("Payments Received (Ingresos)")
        sheetPayments.columns = [
            { header: "DATE", key: "date", width: 15 },
            { header: "STUDENT", key: "studentName", width: 30 },
            { header: "AMOUNT", key: "amount", width: 15 },
            { header: "METHOD", key: "method", width: 15 },
            { header: "NOTES", key: "notes", width: 40 },
        ]

        const studentPayments = await prisma.studentPayment.findMany({
            include: { student: true },
            orderBy: { paymentDate: "desc" }
        })

        studentPayments.forEach(p => {
            sheetPayments.addRow({
                date: p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "-",
                studentName: p.student.fullName,
                amount: Number(p.amount || 0),
                method: p.paymentType,
                notes: p.notes
            })
        })

        // ── 3. SHEET: SUPERVISOR PAYOUTS (EXPENSES) ───────────────────────────
        const sheetSupPayouts = workbook.addWorksheet("Supervisor Payouts (Egresos)")
        sheetSupPayouts.columns = [
            { header: "DATE", key: "date", width: 15 },
            { header: "SUPERVISOR", key: "supName", width: 30 },
            { header: "STUDENT", key: "studName", width: 30 },
            { header: "PERIOD", key: "period", width: 15 },
            { header: "AMOUNT PAID", key: "amount", width: 15 },
        ]

        const supervisorPayments = await prisma.supervisorPayment.findMany({
            include: { supervisor: true, student: true },
            orderBy: { monthYear: "desc" }
        })

        supervisorPayments.forEach(p => {
            sheetSupPayouts.addRow({
                date: p.monthYear ? new Date(p.monthYear).toLocaleDateString() : "-",
                supName: p.supervisor.fullName,
                studName: p.student.fullName,
                period: p.monthYear ? new Date(p.monthYear).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "-",
                amount: Number(p.amountPaidThisMonth || 0)
            })
        })

        // ── 4. SHEET: OFFICE REVENUE LOG (WATERFALL) ──────────────────────────
        const sheetLedger = workbook.addWorksheet("Office Revenue (Libro Mayor)")
        sheetLedger.columns = [
            { header: "DATE", key: "date", width: 15 },
            { header: "STUDENT", key: "student", width: 30 },
            { header: "SUPERVISOR", key: "supervisor", width: 30 },
            { header: "TOTAL COLLECTED", key: "collected", width: 15 },
            { header: "SUPERVISOR SHARE", key: "supShare", width: 15 },
            { header: "OFFICE SHARE (NET)", key: "officeShare", width: 15 },
            { header: "PAYOUT STATUS", key: "status", width: 15 },
        ]

        const ledgerEntries = await (prisma as any).supervisorLedgerEntry.findMany({
            include: {
                student: true,
                supervisor: true
            },
            orderBy: { createdAt: "desc" }
        })

        ledgerEntries.forEach((e: any) => {
            sheetLedger.addRow({
                date: new Date(e.createdAt).toLocaleDateString(),
                student: e.student.fullName,
                supervisor: e.supervisor.fullName,
                collected: Number(e.paymentFromStudent || 0),
                supShare: Number(e.supervisorPayout || 0),
                officeShare: Number(e.officePayout || 0),
                status: e.payoutStatus
            })
        })

        // ── STYLING ───────────────────────────────────────────────────────────
        workbook.eachSheet(sheet => {
            sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } }
            sheet.getRow(1).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FF4F46E5" } // Indigo 600
            }
            sheet.getRow(1).alignment = { horizontal: "center" }
            
            // Format currency columns
            sheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return
                row.eachCell((cell, colNumber) => {
                    const header = String(sheet.getRow(1).getCell(colNumber).value || "").toUpperCase()
                    if (header.includes("AMOUNT") || header.includes("BALANCE") || header.includes("DUE") || header.includes("SHARE") || header.includes("COLLECTED")) {
                        cell.numFmt = '"$"#,##0.00'
                    }
                })
            })
        })

        const buffer = await workbook.xlsx.writeBuffer()
        
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Financial_Master_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        })

    } catch (error) {
        console.error("Export error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
