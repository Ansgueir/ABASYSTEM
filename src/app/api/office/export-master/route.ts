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

        const students: any[] = await (prisma as any).student.findMany({
            include: {
                supervisor: true,
                financialPeriods: { orderBy: { periodNumber: 'asc' } },
                payments: true,
                invoices: true,
            }
        })

        const supervisors: any[] = await (prisma as any).supervisor.findMany({
            include: {
                students: true
            }
        })

        const allStudentPayments: any[] = await (prisma as any).studentPayment.findMany({
            include: { student: { include: { supervisor: true } } },
            orderBy: { paymentDate: 'asc' }
        })

        // ==========================================
        // 1. Sheet "Students"
        // ==========================================
        const sheetStudents = workbook.addWorksheet('Students')
        sheetStudents.columns = [
            { header: 'Cons', key: 'cons', width: 8 },
            { header: 'Trainee Name', key: 'traineeName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Credential', key: 'credential', width: 15 },
            { header: 'VCS Sequence', key: 'vcs', width: 15 },
            { header: 'Level', key: 'level', width: 15 },
            { header: 'Phone Number', key: 'phoneNumber', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'City/State', key: 'cityState', width: 20 },
            { header: 'Option Plan', key: 'option', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
            { header: 'Total Months', key: 'totalMonths', width: 15 },
            { header: 'Regular Hours Target', key: 'regHours', width: 20 },
            { header: 'Concentrated Hours Target', key: 'concHours', width: 25 },
            { header: 'Total Independent Hours Target', key: 'indHours', width: 30 },
            { header: 'Total Amount Contract', key: 'totAmtSup', width: 20 },
            { header: 'Amount to be paid Analyst', key: 'amtPaidAnalyst', width: 25 },
            { header: 'Total Paid to Office', key: 'totPaidOffice', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Comment', key: 'comment', width: 30 },
        ]

        sheetStudents.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetStudents.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }

        let cons = 1;
        for (const student of students) {
            const regHours = Number(student.hoursTargetReg) || 0
            const concHours = Number(student.hoursTargetConc) || 0
            const indHours = Number(student.independentHoursTarget) || 0

            const totAmtSup = Number(student.totalAmountContract) || 0
            const amtPaidAnalyst = totAmtSup * (Number(student.analystPaymentRate) || 0)
            const totPaidOffice = student.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)

            const row = sheetStudents.addRow({
                cons: cons++,
                traineeName: student.fullName,
                supervisorName: student.supervisor?.fullName || null,
                bacbId: student.bacbId || null,
                credential: student.credential,
                vcs: student.vcsSequence || null,
                level: student.level,
                phoneNumber: student.phone,
                email: student.email,
                cityState: `${student.city || ''}, ${student.state || ''}`.trim().replace(/^,|,$/g, ''),
                option: student.assignedOptionPlan || null,
                startDate: student.startDate ? format(new Date(student.startDate), 'yyyy-MM-dd') : null,
                endDate: student.endDate ? format(new Date(student.endDate), 'yyyy-MM-dd') : null,
                totalMonths: student.totalMonths,
                regHours,
                concHours,
                indHours,
                totAmtSup,
                amtPaidAnalyst,
                totPaidOffice,
                status: student.status,
                comment: student.internalComments || null
            })

            row.getCell('totAmtSup').numFmt = '"$"#,##0.00'
            row.getCell('amtPaidAnalyst').numFmt = '"$"#,##0.00'
            row.getCell('totPaidOffice').numFmt = '"$"#,##0.00'
        }

        // ==========================================
        // 2. Sheet "Supervisors"
        // ==========================================
        const sheetSupervisors = workbook.addWorksheet('Supervisors')
        sheetSupervisors.columns = [
            { header: 'Supervisor Name', key: 'name', width: 30 },
            { header: 'Internal ID #', key: 'internalId', width: 15 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Cert #', key: 'cert', width: 15 },
            { header: 'Qualification Level', key: 'qual', width: 20 },
            { header: 'Date Qualified', key: 'dateQual', width: 15 },
            { header: 'Exam Date', key: 'examDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Active Students Count', key: 'studentsCount', width: 20 },
        ]
        sheetSupervisors.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetSupervisors.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }

        for (const sup of supervisors) {
            let activeCount = 0
            for (const st of sup.students) {
                if (st.status === 'ACTIVE') activeCount++
            }

            sheetSupervisors.addRow({
                name: sup.fullName,
                internalId: sup.internalIdNumber || null,
                bacbId: sup.bacbId || null,
                cert: sup.certificantNumber || null,
                qual: (sup as any).qualificationLevel || sup.credentialType,
                dateQual: sup.dateQualified ? format(new Date(sup.dateQualified), 'yyyy-MM-dd') : null,
                examDate: sup.examDate ? format(new Date(sup.examDate), 'yyyy-MM-dd') : null,
                status: sup.status,
                studentsCount: activeCount
            })
        }

        // ==========================================
        // 3. Sheet "Financial History (48 Periods)"
        // ==========================================
        const sheetFinancial = workbook.addWorksheet('Financial History (48 Periods)')
        sheetFinancial.columns = [
            { header: 'Student Name', key: 'studentName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'Period #', key: 'periodNum', width: 10 },
            { header: 'Month', key: 'month', width: 15 },
            { header: 'Due to Office', key: 'dueToOffice', width: 15 },
            { header: 'Due to Office (Accumulated)', key: 'dueToOfficeAcum', width: 25 },
            { header: 'Paid to Office', key: 'paidToOffice', width: 15 },
            { header: 'Paid to Office (Accumulated)', key: 'paidToOfficeAcum', width: 25 },
            { header: 'Due to Analyst', key: 'dueToAnalyst', width: 18 },
            { header: 'Due to Analyst (Total)', key: 'dueToAnalystAcum', width: 22 },
            { header: 'Paid to Analyst', key: 'paidToAnalyst', width: 18 },
            { header: 'Paid to Analyst (Accumulated)', key: 'paidToAnalystAcum', width: 25 },
        ]

        sheetFinancial.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetFinancial.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }

        for (const student of students) {
            let dueToOfficeAcum = 0;
            let paidToOfficeAcum = 0;
            let dueToAnalystAcum = 0;
            let paidToAnalystAcum = 0;

            const periods = student.financialPeriods || [];

            for (let i = 1; i <= 48; i++) {
                const p = periods.find((per: any) => per.periodNumber === i);

                const dueToOffice = p ? Number(p.amountDueOffice) : 0;
                const dueToAnalyst = p ? Number(p.amountDueAnalyst) : 0;

                const prevPO = periods.find((per: any) => per.periodNumber === i - 1);
                const paidToOfficeAcumReal = p ? Number(p.accumulatedPaidOffice) : 0;
                const paidToOffice = paidToOfficeAcumReal - (prevPO ? Number(prevPO.accumulatedPaidOffice) : 0);

                const paidToAnalystAcumReal = p ? Number(p.accumulatedPaidAnalyst) : 0;
                const paidToAnalyst = paidToAnalystAcumReal - (prevPO ? Number(prevPO.accumulatedPaidAnalyst) : 0);

                dueToOfficeAcum += dueToOffice;
                paidToOfficeAcum = paidToOfficeAcumReal;
                dueToAnalystAcum += dueToAnalyst;
                paidToAnalystAcum = paidToAnalystAcumReal;

                if (i >= startPeriod && i <= endPeriod) {
                    const row = sheetFinancial.addRow({
                        studentName: student.fullName,
                        supervisorName: student.supervisor?.fullName || null,
                        periodNum: i,
                        month: p ? p.monthYearLabel : `Period ${i}`,
                        dueToOffice,
                        dueToOfficeAcum,
                        paidToOffice,
                        paidToOfficeAcum,
                        dueToAnalyst,
                        dueToAnalystAcum,
                        paidToAnalyst,
                        paidToAnalystAcum
                    })

                    row.getCell('dueToOffice').numFmt = '"$"#,##0.00'
                    row.getCell('dueToOfficeAcum').numFmt = '"$"#,##0.00'
                    row.getCell('paidToOffice').numFmt = '"$"#,##0.00'
                    row.getCell('paidToOfficeAcum').numFmt = '"$"#,##0.00'
                    row.getCell('dueToAnalyst').numFmt = '"$"#,##0.00'
                    row.getCell('dueToAnalystAcum').numFmt = '"$"#,##0.00'
                    row.getCell('paidToAnalyst').numFmt = '"$"#,##0.00'
                    row.getCell('paidToAnalystAcum').numFmt = '"$"#,##0.00'
                }
            }
        }

        // ==========================================
        // 4. Sheet "Transaction Logs"
        // ==========================================
        const sheetLogs = workbook.addWorksheet('Transaction Logs')
        sheetLogs.columns = [
            { header: 'Trainee Name', key: 'supervisado', width: 30 },
            { header: 'Analyst Name', key: 'analista', width: 30 },
            { header: 'Payment Date', key: 'fechaPago', width: 15 },
            { header: 'Month', key: 'mes', width: 10 },
            { header: 'Month Text', key: 'fechaText', width: 25 },
            { header: 'Amount', key: 'importe', width: 15 },
            { header: 'Payment Method', key: 'tipoPago', width: 20 },
            { header: 'Note', key: 'nota', width: 40 },
            { header: 'Invoiced to Date', key: 'totalAPagar', width: 15 },
            { header: 'Paid to Date', key: 'cobrado', width: 15 },
            { header: 'Balance', key: 'balance', width: 15 },
        ]

        sheetLogs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetLogs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }

        for (const payment of allStudentPayments) {
            const pDate = new Date(payment.paymentDate)
            const sid = payment.studentId

            // Calculate historically accurate balance for this payment moment
            const pastInvoices = await (prisma as any).invoice.aggregate({
                where: { studentId: sid, createdAt: { lte: pDate } },
                _sum: { amountDue: true }
            })
            const pastPayments = await (prisma as any).studentPayment.aggregate({
                where: { studentId: sid, paymentDate: { lte: pDate } },
                _sum: { amount: true }
            })

            const totalInvoiced = Number(pastInvoices._sum.amountDue || 0)
            const totalPaid = Number(pastPayments._sum.amount || 0)
            const balanceNow = totalInvoiced - totalPaid

            const row = sheetLogs.addRow({
                supervisado: payment.student.fullName,
                analista: payment.student.supervisor?.fullName || null,
                fechaPago: format(pDate, 'yyyy-MM-dd'),
                mes: format(pDate, 'MM'),
                fechaText: format(pDate, 'MMMM yyyy'),
                importe: Number(payment.amount),
                tipoPago: payment.paymentType,
                nota: payment.notes || null,
                totalAPagar: totalInvoiced,
                cobrado: totalPaid,
                balance: balanceNow
            })

            row.getCell('importe').numFmt = '"$"#,##0.00'
            row.getCell('totalAPagar').numFmt = '"$"#,##0.00'
            row.getCell('cobrado').numFmt = '"$"#,##0.00'
            row.getCell('balance').numFmt = '"$"#,##0.00'
        }

        // ==========================================
        // 5. Sheet "System Config"
        // ==========================================
        const sheetConfig = workbook.addWorksheet('System Config')
        sheetConfig.columns = [
            { header: 'Plan Option', key: 'plan', width: 15 },
            { header: 'Description', key: 'desc', width: 40 },
            { header: 'Standard Monthly Cost', key: 'cost', width: 25 },
            { header: 'Analyst Default Rate', key: 'analystRate', width: 20 },
        ]
        sheetConfig.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetConfig.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }

        sheetConfig.addRows([
            { plan: 'Option A', desc: 'Standard independent hours with structured curriculum', cost: 150.00, analystRate: 0.54 },
            { plan: 'Option B', desc: 'Concentrated independent hours with intensive review', cost: 200.00, analystRate: 0.54 },
            { plan: 'Option C', desc: 'Custom tailored plan for fast tracking', cost: 250.00, analystRate: 0.60 },
            { plan: 'Option D', desc: 'Part-time continuous education path', cost: 100.00, analystRate: 0.50 },
            { plan: 'Option E', desc: 'External affiliation partial-hours', cost: 75.00, analystRate: 0.50 },
        ])

        sheetConfig.getColumn('cost').numFmt = '"$"#,##0.00'

        // ==========================================
        // Generate buffer
        // ==========================================
        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="Export_Master_Report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })

    } catch (error) {
        console.error("Master Export Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
