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

        // 1. Sheet "Supervisados"
        const sheetSupervisados = workbook.addWorksheet('Supervisados')
        sheetSupervisados.columns = [
            { header: 'Student Name', key: 'fullName', width: 30 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Credential', key: 'credential', width: 15 },
            { header: 'VCS', key: 'vcs', width: 10 },
            { header: 'Option (A-E)', key: 'option', width: 15 },
            { header: 'Start Date', key: 'startDate', width: 15 },
            { header: 'End Date', key: 'endDate', width: 15 },
        ]

        // Header style
        sheetSupervisados.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetSupervisados.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }

        const activeStudents = await prisma.student.findMany({
            where: { status: 'ACTIVE' },
            include: { supervisor: true }
        })

        activeStudents.forEach(student => {
            sheetSupervisados.addRow({
                fullName: student.fullName,
                bacbId: student.bacbId || '',
                credential: student.credential,
                vcs: 'Yes', // Placeholder as not in schema
                option: 'A', // Placeholder as not in schema
                startDate: student.startDate ? format(new Date(student.startDate), 'yyyy-MM-dd') : '',
                endDate: student.endDate ? format(new Date(student.endDate), 'yyyy-MM-dd') : '',
            })
        })

        // 2. Sheet "Base Datos"
        const sheetBaseDatos = workbook.addWorksheet('Base Datos')
        sheetBaseDatos.columns = [
            { header: 'Student Name', key: 'studentName', width: 30 },
            { header: 'Supervisor Name', key: 'supervisorName', width: 30 },
            { header: 'Period #', key: 'periodNum', width: 10 },
            { header: 'Month', key: 'month', width: 15 },
            { header: 'A pagar Ofi', key: 'aPagarOfi', width: 15 },
            { header: 'A Pagar Superv', key: 'aPagarSuperv', width: 15 },
            { header: 'Pagado Ofi', key: 'pagadoOfi', width: 15 },
            { header: 'Pagado Superv', key: 'pagadoSuperv', width: 15 },
        ]

        sheetBaseDatos.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetBaseDatos.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } } // Emerald

        // Fetch all payments for aggregations
        const allStudentPayments = await prisma.studentPayment.findMany()
        const allSupervisorPayments = await prisma.supervisorPayment.findMany()

        for (const student of activeStudents) {
            const startDate = student.startDate ? new Date(student.startDate) : new Date()
            const totalMonths = student.totalMonths > 0 ? student.totalMonths : 48
            const baseAmount = Number(student.amountToPay) || 0

            // Percentage could be from student.supervisor or GeneralValues
            const supPercentage = student.supervisor?.paymentPercentage ? Number(student.supervisor.paymentPercentage) : 0.60

            const pStart = Math.max(1, startPeriod)
            const pEnd = Math.min(totalMonths, endPeriod)

            for (let i = pStart; i <= pEnd; i++) {
                const periodMonth = addMonths(startDate, i - 1)
                const sMonth = startOfMonth(periodMonth)
                const eMonth = endOfMonth(periodMonth)

                // A Pagar Ofi = baseAmount. A Pagar Superv = baseAmount * percentage
                const aPagarOfi = baseAmount
                const aPagarSuperv = baseAmount * supPercentage

                // Pagado Ofi = StudentPayments in this month
                const pagadoOfi = allStudentPayments
                    .filter(p => p.studentId === student.id && p.paymentDate >= sMonth && p.paymentDate <= eMonth)
                    .reduce((sum, p) => sum + Number(p.amount), 0)

                // Pagado Superv = SupervisorPayments in this month (using monthYear)
                const pagadoSuperv = allSupervisorPayments
                    .filter(p => p.studentId === student.id && p.supervisorId === student.supervisorId && new Date(p.monthYear).getTime() === sMonth.getTime())
                    .reduce((sum, p) => sum + Number(p.amountPaidThisMonth), 0)

                const row = sheetBaseDatos.addRow({
                    studentName: student.fullName,
                    supervisorName: student.supervisor?.fullName || 'Unassigned',
                    periodNum: i,
                    month: format(periodMonth, 'yyyy-MM'),
                    aPagarOfi: aPagarOfi,
                    aPagarSuperv: aPagarSuperv,
                    pagadoOfi: pagadoOfi,
                    pagadoSuperv: pagadoSuperv
                })

                // Currency format
                row.getCell('aPagarOfi').numFmt = '"$"#,##0.00'
                row.getCell('aPagarSuperv').numFmt = '"$"#,##0.00'
                row.getCell('pagadoOfi').numFmt = '"$"#,##0.00'
                row.getCell('pagadoSuperv').numFmt = '"$"#,##0.00'
            }
        }

        // 3. Sheet "Cobros"
        const sheetCobros = workbook.addWorksheet('Cobros')
        sheetCobros.columns = [
            { header: 'Fecha Pago', key: 'fechaPago', width: 15 },
            { header: 'Trainee Name', key: 'traineeName', width: 30 },
            { header: 'Tipo Pago', key: 'tipoPago', width: 20 },
            { header: 'Importe', key: 'importe', width: 15 },
            { header: 'Notas', key: 'notas', width: 40 },
        ]

        sheetCobros.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
        sheetCobros.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } } // Amber

        const studentPayments = await prisma.studentPayment.findMany({
            include: { student: true },
            orderBy: { paymentDate: 'asc' }
        })

        studentPayments.forEach(p => {
            const row = sheetCobros.addRow({
                fechaPago: format(new Date(p.paymentDate), 'yyyy-MM-dd'),
                traineeName: p.student.fullName,
                tipoPago: p.paymentType,
                importe: Number(p.amount),
                notas: p.notes || ''
            })
            row.getCell('importe').numFmt = '"$"#,##0.00'
        })

        // 4. Sheet "Opciones" (General Values)
        const sheetOpciones = workbook.addWorksheet('Opciones')
        sheetOpciones.columns = [
            { header: 'Setting', key: 'setting', width: 30 },
            { header: 'Value', key: 'value', width: 30 },
        ]
        sheetOpciones.getRow(1).font = { bold: true }
        sheetOpciones.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } }

        const generalValues = await prisma.generalValues.findFirst()
        if (generalValues) {
            sheetOpciones.addRow({ setting: 'Company Name', value: generalValues.companyName })
            sheetOpciones.addRow({ setting: 'Company Email', value: generalValues.companyEmail })
            const r1 = sheetOpciones.addRow({ setting: 'Rate Regular', value: Number(generalValues.rateRegular) })
            r1.getCell('value').numFmt = '"$"#,##0.00'
            const r2 = sheetOpciones.addRow({ setting: 'Rate Concentrated', value: Number(generalValues.rateConcentrated) })
            r2.getCell('value').numFmt = '"$"#,##0.00'
            const r3 = sheetOpciones.addRow({ setting: 'Supervisor Payment %', value: Number(generalValues.supervisorPaymentPercentage) })
            r3.getCell('value').numFmt = '0.00%'
        }

        // 5. Sheet "Parametros" (Supervisors)
        const sheetParametros = workbook.addWorksheet('Parametros')
        sheetParametros.columns = [
            { header: 'Supervisor Name', key: 'fullName', width: 30 },
            { header: 'BACB ID', key: 'bacbId', width: 15 },
            { header: 'Certificant #', key: 'certNum', width: 15 },
            { header: 'Credential', key: 'credential', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ]
        sheetParametros.getRow(1).font = { bold: true }
        sheetParametros.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B7280' } }

        const supervisors = await prisma.supervisor.findMany({
            orderBy: { fullName: 'asc' }
        })

        supervisors.forEach(s => {
            sheetParametros.addRow({
                fullName: s.fullName,
                bacbId: s.bacbId,
                certNum: s.certificantNumber,
                credential: s.credentialType,
                status: s.status
            })
        })

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
