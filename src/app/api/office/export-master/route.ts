import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from 'exceljs'
import { addMonths, format, startOfMonth, endOfMonth } from "date-fns"

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

        // PRE-FETCH DATA
        const students = await prisma.student.findMany({
            include: {
                supervisor: true,
                supervisionHours: { where: { status: 'APPROVED' } }, // or ALL? Let's take ALL for total historical count or just APPROVED. Billed/Approved is safer.
                independentHours: { where: { status: 'APPROVED' } },
                payments: true,
                invoices: true,
                supervisorPayments: true
            }
        })

        const allStudentPayments = await prisma.studentPayment.findMany({
            include: { student: { include: { supervisor: true } } },
            orderBy: { paymentDate: 'asc' }
        })

        // 1. Sheet "Supervisados"
        const sheetSupervisados = workbook.addWorksheet('Supervisados')
        sheetSupervisados.columns = [
            { header: 'Cons', key: 'cons', width: 8 },
            { header: 'Trainee Name', key: 'traineeName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Credential', key: 'credential', width: 15 },
            { header: 'VCS', key: 'vcs', width: 10 },
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
            const totalSupHours = student.supervisionHours
                .reduce((sum, h) => sum + Number(h.hours), 0)
            const regHours = student.supervisionType === 'REGULAR' ? totalSupHours : 0
            const concHours = student.supervisionType === 'CONCENTRATED' ? totalSupHours : 0
            const indHours = student.independentHours
                .reduce((sum, h) => sum + Number(h.hours), 0)
            const totAmtSup = student.supervisionHours
                .reduce((sum, h) => sum + Number(h.amountBilled || 0), 0)
            const amtPaidAnalyst = student.supervisionHours
                .reduce((sum, h) => sum + Number(h.supervisorPay || 0), 0)
            const totPaidOffice = student.payments
                .reduce((sum, p) => sum + Number(p.amount), 0)

            const row = sheetSupervisados.addRow({
                cons: cons++,
                traineeName: student.fullName,
                supervisorName: student.supervisor?.fullName || null,
                bacbId: student.bacbId || null,
                credential: student.credential,
                vcs: null, // As requested
                level: student.level,
                phoneNumber: student.phone,
                email: student.email,
                cityState: `${student.city || ''}, ${student.state || ''}`.trim().replace(/^,|,$/g, ''),
                option: null, // As requested
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
                comment: student.notes || null
            })

            // Format numbers
            row.getCell('totAmtSup').numFmt = '"$"#,##0.00'
            row.getCell('amtPaidAnalyst').numFmt = '"$"#,##0.00'
            row.getCell('totPaidOffice').numFmt = '"$"#,##0.00'
        }

        // 2. Sheet "Base Datos"
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
            const startDate = student.startDate ? new Date(student.startDate) : new Date()
            const totalMonths = student.totalMonths > 0 ? student.totalMonths : 48
            const baseAmount = Number(student.amountToPay) || 0
            const supPercentage = student.supervisor?.paymentPercentage ? Number(student.supervisor.paymentPercentage) : 0.60

            const pStart = Math.max(1, startPeriod)
            const pEnd = Math.min(totalMonths, endPeriod)

            let aPagarOfiAcum = 0;
            let pagadoOficAcum = 0;
            let aPagarSupervTotal = 0;
            let pagadoSupervAcum = 0;

            // We need to calculate accumulative values correctly. Wait, if user exports period 5-10, they expect ALL accumulated before period 5 to be included in period 5's Acum.
            // So we loop from period 1 up to endPeriod, and only add rows from startPeriod to endPeriod.
            for (let i = 1; i <= pEnd; i++) {
                const periodMonth = addMonths(startDate, i - 1)
                const sMonth = startOfMonth(periodMonth)
                const eMonth = endOfMonth(periodMonth)

                const aPagarOfi = baseAmount
                const aPagarSuperv = baseAmount * supPercentage

                const pagadoOfi = student.payments
                    .filter(p => p.paymentDate >= sMonth && p.paymentDate <= eMonth)
                    .reduce((sum, p) => sum + Number(p.amount), 0)

                const pagadoSuperv = student.supervisorPayments
                    .filter(p => new Date(p.monthYear).getTime() === sMonth.getTime() && p.supervisorId === student.supervisorId)
                    .reduce((sum, p) => sum + Number(p.amountPaidThisMonth), 0)

                aPagarOfiAcum += aPagarOfi;
                pagadoOficAcum += pagadoOfi;
                aPagarSupervTotal += aPagarSuperv;
                pagadoSupervAcum += pagadoSuperv;

                if (i >= pStart) {
                    const row = sheetBaseDatos.addRow({
                        studentName: student.fullName,
                        supervisorName: student.supervisor?.fullName || null,
                        periodNum: i,
                        month: format(periodMonth, 'yyyy-MM'),
                        aPagarOfi,
                        aPagarOfiAcum,
                        pagadoOfi,
                        pagadoOficAcum,
                        aPagarSuperv,
                        aPagarSupervTotal,
                        pagadoSuperv,
                        pagadoSupervAcum
                    })

                    // Formats
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
        }

        // 3. Sheet "Cobros"
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

        // We calculate running totals per student to get the accurate Balance at the moment of payment
        // We need a map of states
        const studentStates = new Map<string, { totalAPagarAcum: number, cobradoAcum: number }>()

        for (const payment of allStudentPayments) {
            const sid = payment.studentId
            if (!studentStates.has(sid)) {
                studentStates.set(sid, { totalAPagarAcum: 0, cobradoAcum: 0 })
            }

            const st = studentStates.get(sid)!
            const pDate = new Date(payment.paymentDate)

            // Wait, "Total a pagar" is the invoice billed amount logic.
            // If we don't know exactly what invoices happened BEFORE this payment, we can at least get 
            // the fixed contract amountToPay per month passed.
            // By the exact prompt: "Total a Pagar", "Cobrado", "Balance".
            // Since this is just a payments log, let's look up invoices up to this date to sum "Amount Due"
            // Alternatively, just pull the student's Total Amount due up to this point from the invoice table.

            // To make it efficient and accurate based on DB invoices instead of calculating contract months:
            const pastInvoices = await prisma.invoice.aggregate({
                where: {
                    studentId: sid,
                    createdAt: { lte: pDate }
                },
                _sum: { amountDue: true }
            })

            const pastPayments = await prisma.studentPayment.aggregate({
                where: {
                    studentId: sid,
                    paymentDate: { lte: pDate }
                },
                _sum: { amount: true }
            })

            const totalInvoiced = Number(pastInvoices._sum.amountDue || 0)
            const totalPaid = Number(pastPayments._sum.amount || 0)
            const balanceNow = totalInvoiced - totalPaid

            const row = sheetCobros.addRow({
                supervisado: payment.student.fullName,
                analista: payment.student.supervisor?.fullName || null,
                fechaPago: format(pDate, 'yyyy-MM-dd'),
                mes: format(pDate, 'M'),
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

        // Generate buffer
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
