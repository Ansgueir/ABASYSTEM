/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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

function mapHeaders(sheet: ExcelJS.Worksheet): Record<string, number> {
    const headerRow = sheet.getRow(1)
    const mapping: Record<string, number> = {}
    headerRow.eachCell((cell, colNumber) => {
        const val = String(cell.value || "").toLowerCase().trim().replace(/_/g, "")
        mapping[val] = colNumber
    })
    return mapping
}

function normalizeCredentialType(val: string): string {
    const v = val.toUpperCase().trim()
    if (v.includes("BCABA")) return "BCaBA"
    if (v.includes("BCBA")) return "BCBA"
    if (v.includes("RBT")) return "RBT"
    if (v.includes("LMHC")) return "LMHC"
    return "NO_CREDENTIAL"
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
                if (name.includes("STUDENT") && !name.includes("PAYMENT") && !name.includes("SUPERVISOR") && !name.includes("GROUP")) sheetStudents = sheet
                if (name.includes("SUPERVISOR") && !name.includes("PAYMENT") && !name.includes("LEDGER") && !name.includes("PAYOUT") && !name.includes("STUDENT") && !name.includes("GROUP")) sheetSupervisors = sheet
                if (name.includes("OFFICE") && !name.includes("GROUP")) sheetOffices = sheet
                if (name.includes("FINANCIAL") || name.includes("COBROS")) sheetFinancial = sheet
                if (name.includes("STUDENTPAYMENT")) sheetStudentPayments = sheet
                if (name.includes("SUPERVISORPAYMENT")) sheetSupervisorPayments = sheet
                if (name.includes("INVOICE")) sheetInvoices = sheet
                if (name.includes("LEDGER")) sheetLedgerEntries = sheet
                if (name.includes("STUDENTSUPERVISOR")) sheetStudentSupervisors = sheet
                if (name === "CONTRACT") sheetContracts = sheet
                if (name.includes("INDEPENDENTHOUR")) sheetIndependentHours = sheet
                if (name === "OFFICEGROUP") sheetGroups = sheet
                if (name === "GROUPSTUDENT") sheetGroupStudents = sheet
                if (name === "GROUPSUPERVISIONSESSION") sheetGroupSessions = sheet
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

            const spm = mapHeaders(sheetSupervisors)
            for (let i = 2; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const name = cellStr(row, spm.fullname || spm.name || spm.id || 2)
                if (!name) continue
                const email = cellStr(row, spm.email || 3).toLowerCase()
                const password = cellStr(row, spm.password || 4) || "Aba12345*"
                const existingSup = existingSupervisors.find(s => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase())
                if (existingSup) continue
                if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "SUPERVISORS" })
                    newSupervisors.push({ fullName: name, email, password, rowNumber: i, credentialType: normalizeCredentialType(cellStr(row, spm.credentialtype || 6) || "BCBA") })
                } else {
                    headlessUsers.push({ name, email, rowNumber: i, sourceSheet: "SUPERVISORS", collisionType: "DUPLICATE" })
                }
            }

            const stm = mapHeaders(sheetStudents)
            for (let i = 2; i <= sheetStudents.rowCount; i++) {
                const row = sheetStudents.getRow(i)
                const name = cellStr(row, stm.fullname || stm.name || 2)
                if (!name) continue
                const email = cellStr(row, stm.email || 3).toLowerCase()
                const password = cellStr(row, stm.password || 4) || "Aba12345*"
                const existingStud = existingStudents.find(s => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase())
                if (existingStud) continue
                if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "STUDENTS" })
                    newUsers.push({ 
                        fullName: name, email, password, rowNumber: i, 
                        supervisorName: cellStr(row, stm.supervisorid || stm.supervisorname || 11),
                        fields: {
                            phone: cellStr(row, stm.phone || 9),
                            startDate: cellDate(row, stm.startdate || 15),
                            endDate: cellDate(row, stm.enddate || 25),
                            status: cellStr(row, stm.status || 26) || "ACTIVE"
                        }
                    })
                }
            }

            const parseGenericSheet = (sheet: ExcelJS.Worksheet | undefined, list: any[]) => {
                if (!sheet) return
                const m = mapHeaders(sheet)
                for (let i = 2; i <= sheet.rowCount; i++) {
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
                const m = mapHeaders(sheet)
                for (let i = 2; i <= sheet.rowCount; i++) {
                    const row = sheet.getRow(i)
                    const data: any = { type, rowNumber: i, sourceSheet: sheet.name }
                    Object.keys(m).forEach(key => data[key] = row.getCell(m[key]).value)
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
                newUsers, newSupervisors, newOffices: [], newContracts, newHours, newGroups, newSessions, newRawPayments, headlessUsers
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
                            supervisor: { create: { fullName: sup.fullName, email: sup.email, credentialType: sup.credentialType, importBatchId: batch.id } }
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
                                fullName: nu.fullName, email: nu.email, 
                                startDate: nu.fields.startDate ? new Date(nu.fields.startDate) : new Date(),
                                endDate: nu.fields.endDate ? new Date(nu.fields.endDate) : new Date(),
                                status: nu.fields.status,
                                supervisorId: nu.supervisorName ? supMap.get(nu.supervisorName.toLowerCase()) : null,
                                importBatchId: batch.id
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
