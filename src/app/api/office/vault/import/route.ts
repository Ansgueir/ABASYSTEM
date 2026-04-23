/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import bcrypt from "bcryptjs"
import { format } from "date-fns"

export const dynamic = "force-dynamic"
export const maxDuration = 300

function cellStr(row: ExcelJS.Row, col: string | number): string {
    const cell = row.getCell(col)
    const v = cell.value
    if (v === null || v === undefined) return ""
    if (typeof v === "object" && !Array.isArray(v) && "richText" in (v as any)) {
        return ((v as any).richText as any[]).map((r: any) => r.text ?? "").join("").trim()
    }
    if (typeof v === "object" && !Array.isArray(v) && "text" in (v as any)) {
        return String((v as any).text ?? "").trim()
    }
    if (typeof v === "object" && !Array.isArray(v) && "result" in (v as any)) {
        return String((v as any).result ?? "").trim()
    }
    if (Array.isArray(v)) {
        return v.map((r: any) => r?.text ?? r).join("").trim()
    }
    return String(v).trim()
}

function cellNum(row: ExcelJS.Row, col: string | number): number {
    const v = row.getCell(col).value
    return v !== null && v !== undefined ? Number(v) : 0
}

function cellDate(row: ExcelJS.Row, col: string | number): Date | null {
    const v = row.getCell(col).value
    if (!v) return null
    const d = new Date(v as string | Date)
    return isNaN(d.getTime()) ? null : d
}

function mapHeaders(sheet: ExcelJS.Worksheet): { mapping: Record<string, number>; headerRowIndex: number; emailCol?: number } {
    let emailCol: number | undefined
    for (let r = 1; r <= 20; r++) {
        const row = sheet.getRow(r)
        const mapping: Record<string, number> = {}
        let foundKeys = 0
        row.eachCell((cell, colNumber) => {
            const val = String(cell.value || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "")
            if (val) {
                mapping[val] = colNumber
                if (["name", "nombre", "email", "correo", "trainee", "student", "alumno", "monto", "amount", "supervisor", "staff", "parametros"].some(k => val.includes(k))) {
                    foundKeys++
                }
            }
        })
        
        if (foundKeys >= 2) {
            for (let testR = r + 1; testR <= r + 10; testR++) {
                const testRow = sheet.getRow(testR)
                testRow.eachCell((c, col) => {
                    const str = String(c.value || "")
                    if (str.includes("@")) emailCol = col
                })
                if (emailCol) break
            }
            return { mapping, headerRowIndex: r, emailCol }
        }
    }
    // Better Fallback
    return { mapping: { name: 2, email: 3, student: 2, trainee: 2, amount: 4 }, headerRowIndex: 1, emailCol: undefined }
}

function normalizeCredentialType(val: string): string {
    const v = val.toUpperCase().trim()
    if (v.includes("BCABA")) return "BCaBA"
    if (v.includes("BCBA")) return "BCBA"
    if (v.includes("RBT")) return "RBT"
    if (v.includes("LMHC")) return "LMHC"
    return "NO_CREDENTIAL"
}

function cellStrFromObj(v: any): string {
    if (v === null || v === undefined) return ""
    return String(v).trim()
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })
        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const contentType = request.headers.get("content-type") || ""

        // ══════════════════════════════════════════
        // STAGING PHASE
        // ══════════════════════════════════════════
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData()
            const file = formData.get("file") as File
            if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(await file.arrayBuffer() as any)

            let sheetStudents: ExcelJS.Worksheet | undefined
            let sheetSupervisors: ExcelJS.Worksheet | undefined
            let sheetOffices: ExcelJS.Worksheet | undefined
            let sheetFinancial: ExcelJS.Worksheet | undefined
            let sheetInvoices: ExcelJS.Worksheet | undefined
            let sheetStudentPayments: ExcelJS.Worksheet | undefined
            let sheetSupervisorPayments: ExcelJS.Worksheet | undefined
            let sheetLedgerEntries: ExcelJS.Worksheet | undefined
            let sheetStudentSupervisors: ExcelJS.Worksheet | undefined
            let sheetContracts: ExcelJS.Worksheet | undefined
            let sheetIndependentHours: ExcelJS.Worksheet | undefined
            let sheetGroups: ExcelJS.Worksheet | undefined
            let sheetGroupStudents: ExcelJS.Worksheet | undefined
            let sheetGroupSessions: ExcelJS.Worksheet | undefined

            workbook.eachSheet((sheet) => {
                const name = sheet.name.toUpperCase().trim()
                // Prioritize Students/Supervisados
                if ((name.includes("STUDENT") || name.includes("SUPERVISADO") || name.includes("ALUMNO") || name.includes("PRACTICANTE") || name.includes("TRAINEE")) && !name.includes("PAYMENT") && !name.includes("GROUP")) {
                    if (!sheetStudents) sheetStudents = sheet
                }
                // Prioritize Supervisors/Parametros
                if ((name.includes("SUPERVISOR") || name.includes("PARAMETRO") || name.includes("STAFF")) && !name.includes("PAYMENT") && !name.includes("LEDGER") && !name.includes("STUDENT") && !name.includes("SUPERVISADO")) {
                    if (!sheetSupervisors) sheetSupervisors = sheet
                }
                
                if (name.includes("OFFICE") && !name.includes("GROUP")) sheetOffices = sheet
                if (name.includes("FINANCIAL") || name.includes("COBROS") || name.includes("CUENTAS")) sheetFinancial = sheet
                if (name.includes("STUDENTPAYMENT") || name.includes("PAGOSALUMNOS")) sheetStudentPayments = sheet
                if (name.includes("SUPERVISORPAYMENT") || name.includes("PAGOSUPERVISOR")) sheetSupervisorPayments = sheet
                if (name.includes("INVOICE") || name.includes("FACTURA")) sheetInvoices = sheet
                if (name.includes("LEDGER") || name.includes("CONTABILIDAD")) sheetLedgerEntries = sheet
                if (name.includes("STUDENTSUPERVISOR") || name.includes("ASIGNACION")) sheetStudentSupervisors = sheet
                if (name === "CONTRACT" || name.includes("CONTRATO")) sheetContracts = sheet
                if (name.includes("INDEPENDENTHOUR") || name.includes("HORAS")) sheetIndependentHours = sheet
                if (name.includes("OFFICEGROUP") || name.includes("GRUPOS")) sheetGroups = sheet
                if (name.includes("GROUPSTUDENT")) sheetGroupStudents = sheet
                if (name.includes("GROUPSUPERVISIONSESSION")) sheetGroupSessions = sheet
            })

            if (!sheetStudents || !sheetSupervisors) {
                return NextResponse.json({ 
                    error: "RECHAZADO: Faltan pestañas críticas (STUDENTS y SUPERVISORS son obligatorias)." 
                }, { status: 422 })
            }

            const existingStudents = await (prisma as any).student.findMany({ include: { user: true } })
            const existingSupervisors = await prisma.supervisor.findMany({ include: { user: true } })
            const existingEmails = new Set((await prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase().trim()))
            const claimedEmailsInBatch = new Map<string, { rowNumber: number; sheetName: string }>()

            const newUsers: any[] = []
            const newSupervisors: any[] = []
            const newContracts: any[] = []
            const newHours: any[] = []
            const newGroups: any[] = []
            const newSessions: any[] = []
            const headlessUsers: any[] = []
            const newRawPayments: any[] = []

            const { mapping: spm, headerRowIndex: spHeaderIdx, emailCol: spEmailCol } = mapHeaders(sheetSupervisors)
            for (let i = spHeaderIdx + 1; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const name = cellStr(row, spm.fullname || spm.nombrecompleto || spm.name || spm.nombre || spm.supervisor || spm.staff || 2)
                if (!name || name.length < 3) continue
                
                let email = (spEmailCol ? cellStr(row, spEmailCol) : cellStr(row, spm.email || spm.correo || spm.correoelectronico || 3)).toLowerCase().trim()
                
                // Aggressive: If no real email, generate one so they show up
                if (!email || !email.includes("@")) {
                    email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${i}@abasystem.tmp`
                }
                
                const password = cellStr(row, spm.password || 4) || "Aba12345*"
                const existingSup = existingSupervisors.find((s: any) => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase())
                if (existingSup) continue
                
                if (!existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "SUPERVISORS" })
                    newSupervisors.push({ 
                        fullName: name, email, password, rowNumber: i, 
                        credentialType: normalizeCredentialType(cellStr(row, spm.credentialtype || 6) || "BCBA"),
                        phone: cellStr(row, spm.phone || 9) || "000-000-0000",
                        address: cellStr(row, spm.address || 10) || "N/A",
                        bacbId: cellStr(row, spm.bacbid || 5) || "N/A",
                        certificantNumber: cellStr(row, spm.certificantnumber || 6) || "N/A"
                    })
                } else {
                    headlessUsers.push({ name, email, rowNumber: i, sourceSheet: "SUPERVISORS", collisionType: "EMAIL_IN_DB" })
                }
            }

            const { mapping: stm, headerRowIndex: stHeaderIdx, emailCol: stEmailCol } = mapHeaders(sheetStudents)
            for (let i = stHeaderIdx + 1; i <= sheetStudents.rowCount; i++) {
                const row = sheetStudents.getRow(i)
                const name = cellStr(row, stm.fullname || stm.name || stm.nombre || stm.nombrecompleto || stm.estudiante || stm.practicante || stm.trainee || 2)
                if (!name) continue
                const email = (stEmailCol ? cellStr(row, stEmailCol) : cellStr(row, stm.email || stm.correo || stm.correoelectronico || 3)).toLowerCase().trim()
                
                const password = cellStr(row, stm.password || 4) || "Aba12345*"
                const existingStud = existingStudents.find((s: any) => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase())
                if (existingStud) continue
                
                if (email && email.includes("@") && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "STUDENTS" })
                    newUsers.push({ 
                        fullName: name, email, password, rowNumber: i, 
                        sourceSheet: "STUDENTS",
                        fields: {
                            supervisorName: cellStr(row, stm.supervisorname || stm.supervisor || stm.supervisorid || 11),
                            phone: cellStr(row, stm.phone || 9),
                            startDate: cellDate(row, stm.startdate || 15),
                            endDate: cellDate(row, stm.enddate || 25),
                            status: cellStr(row, stm.status || 26) || "ACTIVE",
                            hoursTargetReg: cellNum(row, stm.hourstargetreg || stm.reghours || 0),
                            hoursTargetConc: cellNum(row, stm.hourstargetconc || stm.conchours || 0),
                            independentHoursTarget: cellNum(row, stm.independenthourstarget || 0),
                            totalAmountContract: cellNum(row, stm.totalamountcontract || stm.totalcharge || 0),
                            analystPaymentRate: cellNum(row, stm.analystpaymentrate || 0),
                            officePaymentRate: cellNum(row, stm.officepaymentrate || 0)
                        }
                    })
                } else if (name) {
                    headlessUsers.push({ name, email: email || "NO_EMAIL_FOUND", rowNumber: i, sourceSheet: "STUDENTS", collisionType: email.includes("@") ? "EMAIL_IN_DB" : "EMAIL_EMPTY" })
                }
            }

            const parseGenericSheet = (sheet: ExcelJS.Worksheet | undefined, list: any[]) => {
                if (!sheet) return
                const { mapping: m, headerRowIndex: hIdx } = mapHeaders(sheet)
                for (let i = hIdx + 1; i <= sheet.rowCount; i++) {
                    const row = sheet.getRow(i)
                    const data: any = { rowNumber: i, sourceSheet: sheet.name }
                    Object.keys(m).forEach(key => data[key] = row.getCell(m[key]).value)
                    list.push(data)
                }
            }

            parseGenericSheet(sheetContracts, newContracts)
            parseGenericSheet(sheetIndependentHours, newHours)
            parseGenericSheet(sheetGroups, newGroups)
            parseGenericSheet(sheetGroupSessions, newSessions)

            const parseFinancialSheet = (sheet: ExcelJS.Worksheet | undefined, type: string) => {
                if (!sheet) return
                const { mapping: m, headerRowIndex: hIdx } = mapHeaders(sheet)
                for (let i = hIdx + 1; i <= sheet.rowCount; i++) {
                    const row = sheet.getRow(i)
                    const data: any = { type, rowNumber: i, sourceSheet: sheet.name }
                    Object.keys(m).forEach(key => {
                        const val = row.getCell(m[key]).value
                        data[key] = val
                        // Normalize common UI fields
                        if (key.includes("student") || key.includes("trainee") || key.includes("nombre") || key.includes("alumno")) data.studentName = cellStr(row, m[key])
                        if (key.includes("month") || key.includes("year") || key.includes("period") || key.includes("periodo") || key.includes("mes")) data.monthYearLabel = cellStr(row, m[key])
                        if (key.includes("amount") || key.includes("due") || key.includes("monto") || key.includes("cobro") || (type === "STUDENT_PAYMENT" && key === "amount")) {
                            data.amountDueOffice = cellNum(row, m[key])
                            data.amount = cellNum(row, m[key])
                        }
                        if (key.includes("date") || key.includes("fecha")) data.paymentDate = cellDate(row, m[key])
                        if (key.includes("type") || key.includes("method") || key.includes("metodo") || key.includes("forma")) data.paymentType = cellStr(row, m[key])
                    })
                    newRawPayments.push(data)
                }
            }
            parseFinancialSheet(sheetStudentPayments, "STUDENT_PAYMENT")
            parseFinancialSheet(sheetSupervisorPayments, "SUPERVISOR_PAYMENT")
            parseFinancialSheet(sheetInvoices, "INVOICE")
            parseFinancialSheet(sheetLedgerEntries, "LEDGER_ENTRY")

            return NextResponse.json({
                summary: {
                    newStudents: newUsers.length,
                    newSupervisors: newSupervisors.length,
                    newContracts: newContracts.length,
                    newHours: newHours.length,
                    newGroups: newGroups.length,
                    newSessions: newSessions.length,
                    financialRecords: newRawPayments.length,
                    conflicts: headlessUsers.length
                },
                // Statistics for the UI
                studentsStats: { new: newUsers.length, updated: 0 },
                supervisorsStats: { new: newSupervisors.length, updated: 0 },
                financialStats: { clean: newRawPayments.length, conflicts: 0 },
                transactionStats: { new: newRawPayments.length },
                ignoredRows: [],
                skippedRowsCount: 0,
                newUsers, 
                newSupervisors, 
                newOffices: [], 
                newContracts, 
                newHours, 
                newGroups, 
                newSessions, 
                newRawPayments, 
                newFinancialPeriods: newRawPayments, // Mirror for the UI
                headlessUsers,
                conflicts: [],
                resolutions: {}
            })

        // ══════════════════════════════════════════
        // COMMIT PHASE (ACTION)
        // ══════════════════════════════════════════
        } else if (contentType.includes("application/json")) {
            const body = await request.json()
            const { newUsers, newSupervisors, newContracts, newHours, newGroups, newSessions, newRawPayments } = body
            const batchString = `MASS_LOAD_${format(new Date(), 'yyyyMMdd_HHmm')}`

            const result = await prisma.$transaction(async (tx) => {
                const batch = await (tx as any).importBatch.create({ data: { batchString, status: "COMPLETED" } })
                const supMap = new Map<string, string>()
                const studMap = new Map<string, string>()
                const groupMap = new Map<string, string>()
                const invoiceMap = new Map<string, string>()

                for (const sup of newSupervisors) {
                    const hash = await bcrypt.hash(sup.password, 10)
                    const user = await tx.user.create({
                        data: {
                            email: sup.email, passwordHash: hash, role: "SUPERVISOR", isActive: true,
                            supervisor: { 
                                create: { 
                                    fullName: sup.fullName, 
                                    email: sup.email, 
                                    credentialType: sup.credentialType, 
                                    importBatchId: batch.id,
                                    phone: sup.phone || "000-000-0000",
                                    address: sup.address || "N/A",
                                    bacbId: sup.bacbId || "N/A",
                                    certificantNumber: sup.certificantNumber || "N/A"
                                } 
                            }
                        } as any,
                        include: { supervisor: true } as any
                    })
                    const s = (user as any).supervisor
                    supMap.set(s.fullName.toLowerCase(), s.id)
                }

                const allSups = await tx.supervisor.findMany()
                allSups.forEach(s => supMap.set(s.fullName.toLowerCase(), s.id))

                for (const nu of newUsers) {
                    const hash = await bcrypt.hash(nu.password, 10)
                    const user = await tx.user.create({
                        data: {
                            email: nu.email, passwordHash: hash, role: "STUDENT", isActive: true,
                            student: { create: { 
                                fullName: nu.fullName, 
                                email: nu.email, 
                                startDate: nu.fields.startDate ? new Date(nu.fields.startDate) : new Date(),
                                endDate: nu.fields.endDate ? new Date(nu.fields.endDate) : new Date(),
                                status: nu.fields.status || "ACTIVE",
                                supervisorId: nu.fields.supervisorName ? supMap.get(nu.fields.supervisorName.toLowerCase()) : null,
                                importBatchId: batch.id,
                                phone: nu.fields.phone || "000-000-0000",
                                bacbId: "N/A",
                                credential: "BCBA",
                                school: "N/A",
                                level: "BCBA",
                                city: "N/A",
                                state: "N/A",
                                supervisionType: "REGULAR",
                                fieldworkType: "REGULAR",
                                supervisionPercentage: 0.05,
                                hoursToDo: nu.fields.hoursTargetReg || 1500,
                                hoursToPay: 0,
                                amountToPay: nu.fields.totalAmountContract || 0,
                                hourlyRate: 0,
                                hoursPerMonth: 130,
                                totalMonths: 12
                            } }
                        } as any,
                        include: { student: true } as any
                    })
                    const s = (user as any).student
                    studMap.set(s.fullName.toLowerCase(), s.id)
                }

                const allStuds = await tx.student.findMany()
                allStuds.forEach(s => studMap.set(s.fullName.toLowerCase(), s.id))

                for (const g of (newGroups || [])) {
                    const created = await (tx as any).officeGroup.create({
                        data: { name: g.name, groupType: g.grouptype || "GROUP", dayOfWeek: g.dayofweek, startTime: g.starttime, endTime: g.endtime }
                    })
                    groupMap.set(g.name.toLowerCase(), created.id)
                }

                for (const c of (newContracts || [])) {
                    const studentId = studMap.get(cellStrFromObj(c.studentname || c.studentid)?.toLowerCase())
                    if (!studentId) continue
                    await (tx as any).contract.create({
                        data: { studentId, effectiveDate: c.effectivedate ? new Date(c.effectivedate) : new Date(), status: c.status || "SIGNED", importBatchId: batch.id }
                    })
                }

                for (const h of (newHours || [])) {
                    const studentId = studMap.get(cellStrFromObj(h.studentname || h.studentid)?.toLowerCase())
                    if (!studentId) continue
                    await (tx as any).independentHour.create({
                        data: {
                            studentId, date: new Date(h.date), hours: Number(h.hours),
                            activityType: h.activitytype || "DIRECT", status: "APPROVED", importBatchId: batch.id
                        }
                    })
                }

                for (const rp of newRawPayments) {
                    const sid = studMap.get(cellStrFromObj(rp.studentname || rp.studentid)?.toLowerCase())
                    if (!sid) continue

                    if (rp.type === "INVOICE") {
                        const inv = await (tx as any).invoice.create({
                            data: { 
                                studentId: sid, 
                                invoiceDate: new Date(rp.invoicedate), 
                                amountDue: Number(rp.amountdue), 
                                amountPaid: Number(rp.amountpaid), 
                                status: rp.status || "PAID",
                                importBatchId: batch.id
                            }
                        })
                        if (rp.id) invoiceMap.set(rp.id, inv.id)
                    } else if (rp.type === "STUDENT_PAYMENT") {
                        await (tx as any).studentPayment.create({
                            data: { studentId: sid, amount: Number(rp.amount), paymentDate: new Date(rp.paymentdate || rp.date), paymentType: rp.paymenttype || "ZELLE", importBatchId: batch.id }
                        })
                    } else if (rp.type === "LEDGER_ENTRY") {
                        const supId = supMap.get(cellStrFromObj(rp.supervisorname || rp.supervisorid)?.toLowerCase())
                        const invId = rp.invoiceid ? (invoiceMap.get(rp.invoiceid) || rp.invoiceid) : null
                        if (supId && invId) {
                            await (tx as any).supervisorLedgerEntry.create({
                                data: {
                                    invoiceId: invId, supervisorId: supId, studentId: sid,
                                    paymentFromStudent: Number(rp.paymentfromstudent), supervisorPayout: Number(rp.supervisorpayout),
                                    officePayout: Number(rp.officepayout), payoutStatus: rp.payoutstatus || "PAID",
                                    importBatchId: batch.id
                                }
                            } as any)
                        }
                    }
                }
            }, { timeout: 600000 })
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
