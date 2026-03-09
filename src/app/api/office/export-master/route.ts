import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from 'exceljs'
import { format, parseISO } from "date-fns"

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
        // 1. Sheet "Supervisados"
        // ==========================================
        const sheetSupervisados = workbook.addWorksheet('Supervisados')
        sheetSupervisados.columns = [
            { header: 'Cons', key: 'cons', width: 8 },
            { header: 'Trainee Name', key: 'traineeName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Credential', key: 'credential', width: 15 },
            { header: 'VCS', key: 'vcs', width: 15 },
            { header: 'Level', key: 'level', width: 15 },
            { header: 'Phone Number', key: 'phoneNumber', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'City/State', key: 'cityState', width: 20 },
            { header: 'Option', key: 'option', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
            { header: 'Total Months', key: 'totalMonths', width: 15 },
            { header: 'Regular Hours', key: 'regHours', width: 15 },
            { header: 'Concent Hours', key: 'concHours', width: 15 },
            { header: 'Total Independ Hours', key: 'indHours', width: 20 },
            { header: 'Total Amount Superv.', key: 'totAmtSup', width: 20 },
            { header: 'Amount to be paid- Analyst', key: 'amtPaidAnalyst', width: 25 },
            { header: 'Total Paid to Office', key: 'totPaidOffice', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Comment', key: 'comment', width: 30 },
        ]

        sheetSupervisados.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetSupervisados.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }

        let cons = 1;
        for (const student of students) {
            // Using mapped new DB fields explicitly requested
            const regHours = Number(student.regularHoursTarget) || 0
            const concHours = Number(student.concentratedHoursTarget) || 0
            const indHours = Number(student.independentHoursTarget) || 0

            const totAmtSup = Number(student.totalAmountContract) || 0
            const amtPaidAnalyst = totAmtSup * (Number(student.analystPaymentRate) || 0)
            const totPaidOffice = student.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0)

            const row = sheetSupervisados.addRow({
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
        // 2. Sheet "Base Datos"
        // ==========================================
        const sheetBaseDatos = workbook.addWorksheet('Base Datos')
        sheetBaseDatos.columns = [
            { header: 'Student Name', key: 'studentName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'Period #', key: 'periodNum', width: 10 },
            { header: 'Month', key: 'month', width: 15 },
            { header: 'A pagar Ofi', key: 'aPagarOfi', width: 15 },
            { header: 'A pagar Ofi Acum', key: 'aPagarOfiAcum', width: 18 },
            { header: 'Pagado Ofi', key: 'pagadoOfi', width: 15 },
            { header: 'Pagado Ofic Acum', key: 'pagadoOficAcum', width: 18 },
            { header: 'A Pagar Superv', key: 'aPagarSuperv', width: 18 },
            { header: 'A Pagar Superv Total', key: 'aPagarSupervTotal', width: 22 },
            { header: 'Pagado Superv', key: 'pagadoSuperv', width: 18 },
            { header: 'Pagado Superv. Acum', key: 'pagadoSupervAcum', width: 22 },
        ]

        sheetBaseDatos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetBaseDatos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }

        for (const student of students) {
            let aPagarOfiAcum = 0;
            let pagadoOficAcum = 0;
            let aPagarSupervTotal = 0;
            let pagadoSupervAcum = 0;

            const periods = student.financialPeriods || [];

            for (let i = 1; i <= 48; i++) {
                const p = periods.find((per: any) => per.periodNumber === i);

                const aPagarOfi = p ? Number(p.amountDueOffice) : 0;
                const aPagarSuperv = p ? Number(p.amountDueAnalyst) : 0;

                // For Payments in that specific period, we calculate the delta from accumulated
                const prevPO = periods.find((per: any) => per.periodNumber === i - 1);
                const pagadoOficAcumReal = p ? Number(p.accumulatedPaidOffice) : 0;
                const pagadoOfi = pagadoOficAcumReal - (prevPO ? Number(prevPO.accumulatedPaidOffice) : 0);

                const pagadoSupervAcumReal = p ? Number(p.accumulatedPaidAnalyst) : 0;
                const pagadoSuperv = pagadoSupervAcumReal - (prevPO ? Number(prevPO.accumulatedPaidAnalyst) : 0);

                aPagarOfiAcum += aPagarOfi;
                pagadoOficAcum = pagadoOficAcumReal; // Take direct from DB
                aPagarSupervTotal += aPagarSuperv;
                pagadoSupervAcum = pagadoSupervAcumReal;

                const row = sheetBaseDatos.addRow({
                    studentName: student.fullName,
                    supervisorName: student.supervisor?.fullName || null,
                    periodNum: i,
                    month: p ? p.monthYearLabel : `Periodo ${i}`,
                    aPagarOfi,
                    aPagarOfiAcum,
                    pagadoOfi,
                    pagadoOficAcum,
                    aPagarSuperv,
                    aPagarSupervTotal,
                    pagadoSuperv,
                    pagadoSupervAcum
                })

                row.getCell('aPagarOfi').numFmt = '"$"#,##0.00'
                row.getCell('aPagarOfiAcum').numFmt = '"$"#,##0.00'
                row.getCell('pagadoOfi').numFmt = '"$"#,##0.00'
                row.getCell('pagadoOficAcum').numFmt = '"$"#,##0.00'
                row.getCell('aPagarSuperv').numFmt = '"$"#,##0.00'
                row.getCell('aPagarSupervTotal').numFmt = '"$"#,##0.00'
                row.getCell('pagadoSuperv').numFmt = '"$"#,##0.00'
                row.getCell('pagadoSupervAcum').numFmt = '"$"#,##0.00'
            }
        }

        // ==========================================
        // 3. Sheet "Cobros"
        // ==========================================
        const sheetCobros = workbook.addWorksheet('Cobros')
        sheetCobros.columns = [
            { header: 'Supervisado', key: 'supervisado', width: 30 },
            { header: 'Analista', key: 'analista', width: 30 },
            { header: 'Fecha Pago', key: 'fechaPago', width: 15 },
            { header: 'Mes', key: 'mes', width: 10 },
            { header: 'Fecha Text', key: 'fechaText', width: 25 },
            { header: 'Importe', key: 'importe', width: 15 },
            { header: 'Tipo Pago', key: 'tipoPago', width: 20 },
            { header: 'Nota', key: 'nota', width: 40 },
            { header: 'Total a Pagar', key: 'totalAPagar', width: 15 },
            { header: 'Cobrado', key: 'cobrado', width: 15 },
            { header: 'Balance', key: 'balance', width: 15 },
        ]

        sheetCobros.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetCobros.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }

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

            const row = sheetCobros.addRow({
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
        // 4. Sheet "Opciones"
        // ==========================================
        const sheetOpciones = workbook.addWorksheet('Opciones')
        sheetOpciones.columns = [
            { header: 'Plan Option', key: 'plan', width: 15 },
            { header: 'Description', key: 'desc', width: 40 },
            { header: 'Standard Monthly Cost', key: 'cost', width: 20 },
            { header: 'Analyst Default Rate', key: 'analystRate', width: 20 },
        ]
        sheetOpciones.getRow(1).font = { bold: true }

        sheetOpciones.addRows([
            { plan: 'Option A', desc: 'Standard independent hours with structured curriculum', cost: 150.00, analystRate: 0.54 },
            { plan: 'Option B', desc: 'Concentrated independent hours with intensive review', cost: 200.00, analystRate: 0.54 },
            { plan: 'Option C', desc: 'Custom tailored plan for fast tracking', cost: 250.00, analystRate: 0.60 },
            { plan: 'Option D', desc: 'Part-time continuous education path', cost: 100.00, analystRate: 0.50 },
            { plan: 'Option E', desc: 'External affiliation partial-hours', cost: 75.00, analystRate: 0.50 },
        ])

        sheetOpciones.getColumn('cost').numFmt = '"$"#,##0.00'

        // ==========================================
        // 5. Sheet "Parametros"
        // ==========================================
        const sheetParametros = workbook.addWorksheet('Parametros')
        sheetParametros.columns = [
            { header: 'Supervisor Name', key: 'name', width: 30 },
            { header: 'Internal ID #', key: 'internalId', width: 15 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Certificant #', key: 'cert', width: 15 },
            { header: 'Qualification Level', key: 'qual', width: 20 },
            { header: 'Date Qualified', key: 'dateQual', width: 15 },
            { header: 'Exam Date', key: 'examDate', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ]
        sheetParametros.getRow(1).font = { bold: true }

        for (const sup of supervisors) {
            sheetParametros.addRow({
                name: sup.fullName,
                internalId: sup.internalIdNumber || null,
                bacbId: sup.bacbId || null,
                cert: sup.certificantNumber || null,
                qual: (sup as any).qualificationLevel || sup.credentialType,
                dateQual: sup.dateQualified ? format(new Date(sup.dateQualified), 'yyyy-MM-dd') : null,
                examDate: sup.examDate ? format(new Date(sup.examDate), 'yyyy-MM-dd') : null,
                status: sup.status
            })
        }

        // ==========================================
        // 6. Sheet "Pivot Table por Supervisor"
        // ==========================================
        const sheetPivotSup = workbook.addWorksheet('Pivot Table por Supervisor')
        sheetPivotSup.columns = [
            { header: 'Analyst Name', key: 'analyst', width: 30 },
            { header: 'Active Students', key: 'students', width: 15 },
            { header: 'Total Due to Analyst', key: 'due', width: 20 },
            { header: 'Total Paid to Analyst', key: 'paid', width: 20 },
            { header: 'Pending Balance', key: 'balance', width: 20 },
        ]
        sheetPivotSup.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetPivotSup.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }

        for (const sup of supervisors) {
            let totalDue = 0
            let totalPaid = 0
            let activeCount = 0

            for (const st of sup.students) {
                if (st.status === 'ACTIVE') activeCount++

                // We sum up the 48 periods accumulated final value
                const relatedPeriods = students.find(s => s.id === st.id)?.financialPeriods || []
                if (relatedPeriods.length > 0) {
                    const lastPeriod = relatedPeriods[relatedPeriods.length - 1]
                    // Or we just find the max if they stop early. We'll take the max accumulated.
                    const maxDue = Math.max(...relatedPeriods.map((p: any) => Number(p.amountDueAnalyst) || 0)) * 48 // simplistic fallback

                    // Actually, the schema has accumulated values in `accumulatedPaidAnalyst`. 
                    // Let's sum the raw `amountDueAnalyst` across all periods
                    const sumDue = relatedPeriods.reduce((acc: number, p: any) => acc + Number(p.amountDueAnalyst || 0), 0)
                    const maxPaid = Math.max(...relatedPeriods.map((p: any) => Number(p.accumulatedPaidAnalyst || 0)))

                    totalDue += sumDue
                    totalPaid += maxPaid
                }
            }

            const row = sheetPivotSup.addRow({
                analyst: sup.fullName,
                students: activeCount,
                due: totalDue,
                paid: totalPaid,
                balance: totalDue - totalPaid
            })
            row.getCell('due').numFmt = '"$"#,##0.00'
            row.getCell('paid').numFmt = '"$"#,##0.00'
            row.getCell('balance').numFmt = '"$"#,##0.00'
        }

        // ==========================================
        // 7. Sheet "Pivot Table por Supervisees"
        // ==========================================
        const sheetPivotStud = workbook.addWorksheet('Pivot Table por Supervisees')
        sheetPivotStud.columns = [
            { header: 'Student Name', key: 'student', width: 30 },
            { header: 'Assigned Analyst', key: 'analyst', width: 30 },
            { header: 'Contract Plan', key: 'plan', width: 15 },
            { header: 'Total Contract Value', key: 'contractValue', width: 20 },
            { header: 'Total Invoiced / Due', key: 'invoiced', width: 20 },
            { header: 'Total Paid to Office', key: 'paid', width: 20 },
            { header: 'Student Debt Balance', key: 'balance', width: 20 },
        ]
        sheetPivotStud.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetPivotStud.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEC4899' } }

        for (const student of students) {
            const periods = student.financialPeriods || []
            const sumDue = periods.reduce((acc: number, p: any) => acc + Number(p.amountDueOffice || 0), 0)
            const maxPaid = Math.max(0, ...periods.map((p: any) => Number(p.accumulatedPaidOffice || 0)))

            const row = sheetPivotStud.addRow({
                student: student.fullName,
                analyst: student.supervisor?.fullName || 'N/A',
                plan: student.assignedOptionPlan || 'N/A',
                contractValue: Number(student.totalAmountContract || 0),
                invoiced: sumDue,
                paid: maxPaid,
                balance: sumDue - maxPaid
            })

            row.getCell('contractValue').numFmt = '"$"#,##0.00'
            row.getCell('invoiced').numFmt = '"$"#,##0.00'
            row.getCell('paid').numFmt = '"$"#,##0.00'
            row.getCell('balance').numFmt = '"$"#,##0.00'
        }

        // ==========================================
        // 8. Sheet "Tesoreria"
        // ==========================================
        const sheetTesoreria = workbook.addWorksheet('Tesoreria')
        sheetTesoreria.columns = [
            { header: 'Metric Category', key: 'metric', width: 40 },
            { header: 'Global Value', key: 'value', width: 20 },
        ]
        sheetTesoreria.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetTesoreria.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }

        const totalExpectedRevenue = students.reduce((acc: number, st: any) => acc + Number(st.totalAmountContract || 0), 0)
        let totalBilledToDate = 0
        let totalCollectedToDate = 0

        for (const student of students) {
            const periods = student.financialPeriods || []
            totalBilledToDate += periods.reduce((acc: number, p: any) => acc + Number(p.amountDueOffice || 0), 0)
            totalCollectedToDate += Math.max(0, ...periods.map((p: any) => Number(p.accumulatedPaidOffice || 0)))
        }

        const stats = [
            { metric: 'Total Expected Contract Revenue (All Time)', value: totalExpectedRevenue },
            { metric: 'Total Gross Billed to Date', value: totalBilledToDate },
            { metric: 'Total Gross Collections to Date', value: totalCollectedToDate },
            { metric: 'Global Accounts Receivable (Balance Pending)', value: totalBilledToDate - totalCollectedToDate },
            { metric: 'Total Active Students', value: students.filter(s => s.status === 'ACTIVE').length },
            { metric: 'Total Registered Analysts', value: supervisors.length },
        ]

        for (const stat of stats) {
            const row = sheetTesoreria.addRow(stat)
            if (typeof stat.value === 'number' && stat.metric.includes('Total')) {
                if (stat.metric.includes('Students') || stat.metric.includes('Analysts')) {
                    // plain number
                } else {
                    row.getCell('value').numFmt = '"$"#,##0.00'
                }
            } else if (typeof stat.value === 'number') {
                row.getCell('value').numFmt = '"$"#,##0.00'
            }
        }

        // ==========================================
        // Generate buffer
        // ==========================================
        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="Export_Master_${format(new Date(), 'yyyyMMdd')}.xlsx"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            }
        })

    } catch (error) {
        console.error("Master Export Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
