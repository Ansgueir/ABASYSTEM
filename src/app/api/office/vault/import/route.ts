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

            // Case-insensitive worksheet detection
            let sheetStudents: ExcelJS.Worksheet | undefined
            let sheetSupervisors: ExcelJS.Worksheet | undefined
            let sheetOffices: ExcelJS.Worksheet | undefined
            let sheetFinancial: ExcelJS.Worksheet | undefined

            console.log("[IMPORT DEBUG] Worksheets found:", workbook.worksheets.map(s => `"${s.name}"`))

            let sheetInvoices: ExcelJS.Worksheet | undefined
            let sheetStudentPayments: ExcelJS.Worksheet | undefined
            let sheetSupervisorPayments: ExcelJS.Worksheet | undefined
            let sheetLedgerEntries: ExcelJS.Worksheet | undefined
            let sheetStudentSupervisors: ExcelJS.Worksheet | undefined

            workbook.eachSheet((sheet) => {
                const name = sheet.name.toUpperCase().trim()
                if (name.includes("STUDENT") && !name.includes("PAYMENT") && !name.includes("SUPERVISOR")) sheetStudents = sheet
                if (name.includes("SUPERVISOR") && !name.includes("PAYMENT") && !name.includes("LEDGER") && !name.includes("PAYOUT") && !name.includes("STUDENT")) sheetSupervisors = sheet
                if (name.includes("OFFICE")) sheetOffices = sheet
                if (name.includes("FINANCIAL") || name.includes("COBROS")) sheetFinancial = sheet
                if (name.includes("STUDENTPAYMENT")) sheetStudentPayments = sheet
                if (name.includes("SUPERVISORPAYMENT")) sheetSupervisorPayments = sheet
                if (name.includes("INVOICE")) sheetInvoices = sheet
                if (name.includes("LEDGER")) sheetLedgerEntries = sheet
                if (name.includes("STUDENTSUPERVISOR")) sheetStudentSupervisors = sheet
            })

            if (!sheetStudents || !sheetSupervisors) {
                return NextResponse.json({ 
                    error: "RECHAZADO: Faltan pestañas críticas (STUDENTS y SUPERVISORS son obligatorias)." 
                }, { status: 422 })
            }

            const existingStudents = await (prisma as any).student.findMany({ 
                include: { user: true, financialPeriods: true, supervisor: true } 
            })
            console.log("[PRISMA DEBUG] Status:", {
                prismaExists: !!prisma,
                supervisorExists: !!(prisma as any).supervisor,
                officeExists: !!(prisma as any).office,
                importBatchExists: !!(prisma as any).importBatch
            })
            console.log("[PRISMA MODELS FOUND]:", Object.keys(prisma).filter(k => !k.startsWith("_") && !k.startsWith("$")))

            const existingSupervisors = await prisma.supervisor.findMany({ 
                include: { user: true } 
            })
            const existingOffices = await (prisma as any).officeMember.findMany({ 
                include: { user: true } 
            })
            const existingEmails = new Set(
                (await prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase().trim())
            )
            const claimedEmailsInBatch = new Map<string, { rowNumber: number; sheetName: string }>()

            const newUsers: any[] = []
            const newSupervisors: any[] = []
            const newOffices: any[] = []
            const supervisorUpdates: any[] = [] // Will be kept empty to protect existing
            const conflicts: any[] = []
            const newFinancialPeriods: any[] = []
            const newRawPayments: any[] = []
            const headlessUsers: any[] = []
            const validData: any = { studentsToUpdate: [] } // Will be kept empty to protect existing

            // ── §1 Parse SUPERVISORS ───────────────────────────
            for (let i = 2; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const name = cellStr(row, "B")
                if (!name) continue

                const email = cellStr(row, "C").toLowerCase()
                const password = cellStr(row, "D") || "Aba12345*"
                const bacbId = cellStr(row, "E")
                const qual = cellStr(row, "F")

                const phone = cellStr(row, "G") || "000-000-0000"
                const address = cellStr(row, "H") || "N/A"

                const existingSup = existingSupervisors.find(
                    s => s.id === name || s.userId === name || s.fullName.toLowerCase().trim() === name.toLowerCase().trim() || (email && s.user.email === email)
                )

                if (existingSup) {
                    // SKIP UPDATES to protect existing users
                    continue
                } else if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "SUPERVISORS" })
                    newSupervisors.push({ 
                        fullName: name, 
                        email, 
                        password, 
                        bacbId, 
                        phone,
                        address,
                        credentialType: normalizeCredentialType(qual || "BCBA"), 
                        rowNumber: i, 
                        sourceSheet: "SUPERVISORS" 
                    })
                } else {
                    headlessUsers.push({ name, email: email || "(vacio)", rowNumber: i, sourceSheet: "SUPERVISORS", collisionType: "EMAIL_DUPLICATE" })
                }
            }

            // ── §2 Parse OFFICES ───────────────────────────
            if (sheetOffices) {
                for (let i = 2; i <= sheetOffices.rowCount; i++) {
                    const row = sheetOffices.getRow(i)
                    const name = cellStr(row, "B")
                    const email = cellStr(row, "C").toLowerCase()
                    const password = cellStr(row, "D") || "Aba12345*"
                    if (!name || !email) continue

                    if (!existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                        claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "OFFICES" })
                        newOffices.push({ fullName: name, email, password, rowNumber: i, sourceSheet: "OFFICES" })
                    } else {
                        headlessUsers.push({ name, email: email || "(vacio)", rowNumber: i, sourceSheet: "OFFICES", collisionType: "EMAIL_DUPLICATE" })
                    }
                }
            }

            // ── §3 Parse STUDENTS ────────────────────────────
            for (let i = 2; i <= sheetStudents.rowCount; i++) {
                const row = sheetStudents.getRow(i)
                const name = cellStr(row, "B")
                if (!name) continue

                const email = cellStr(row, "C").toLowerCase()
                const password = cellStr(row, "D") || "Aba12345*"
                const bacbId = cellStr(row, "E")
                const supervisorName = cellStr(row, "G")

                const existingStud = existingStudents.find((s: any) => s.id === name || s.userId === name || s.bacbId === bacbId || (email && s.user.email === email))
                
                const fields = {
                    credential:             normalizeCredentialType(cellStr(row, "F")),
                    phone:                 cellStr(row, "H") || "000-000-0000",
                    startDate:             cellDate(row, "I"),
                    endDate:               cellDate(row, "J"),
                    hoursPerMonth:         cellNum(row, "K") || 130,
                    hoursToDo:             cellNum(row, "L") || 2000,
                    status:                cellStr(row, "M") || "ACTIVE",
                    vcsSequence:           cellStr(row, "N") || null,
                    assignedOptionPlan:    cellStr(row, "O") || "PLAN MANUAL",
                    hoursTargetReg:        cellNum(row, "P") || null,
                    hoursTargetConc:       cellNum(row, "Q") || null,
                    independentHoursTarget: cellNum(row, "R") || null,
                    totalAmountContract:   cellNum(row, "S") || null,
                    analystPaymentRate:    cellNum(row, "T") || null,
                    officePaymentRate:     cellNum(row, "U") || null,
                    city:                  cellStr(row, "V") || "N/A",
                    state:                 cellStr(row, "W") || "N/A",
                    school:                cellStr(row, "X") || "N/A",
                    level:                 (cellStr(row, "Y") || "BCBA") as any,
                    supervisionPercentage: 0.05,
                    supervisionType:       "REGULAR",
                    hoursToPay:            0,
                    amountToPay:           0.0,
                }


                
                if (!existingStud) {
                    if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                        claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "STUDENTS" })
                        newUsers.push({ fullName: name, email, password, supervisorName, fields, rowNumber: i, sourceSheet: "STUDENTS" })
                    } else {
                        headlessUsers.push({ name, email: email || "(vacio)", rowNumber: i, sourceSheet: "STUDENTS", collisionType: "EMAIL_DUPLICATE" })
                    }
                } else {
                    // SKIP UPDATES to protect existing users
                    continue
                }
            }

            // ── §4 Parse FINANCIALS ──────────────────────────
            if (sheetFinancial) {
                for (let i = 2; i <= sheetFinancial.rowCount; i++) {
                    const row = sheetFinancial.getRow(i)
                    const name = cellStr(row, "B").toLowerCase().trim()
                    if (!name) continue
                    const period = cellNum(row, "C")
                    const amount = cellNum(row, "D")
                    if (!period || amount === 0) continue

                    const stud = existingStudents.find((s: any) => s.fullName.toLowerCase().trim() === name)
                    if (stud) {
                        const existingPeriod = stud.financialPeriods.find((p: any) => p.periodNumber === period)
                        if (existingPeriod && Number(existingPeriod.amountDueOffice) !== amount) {
                            conflicts.push({ 
                                id: `CFL-${existingPeriod.id}`, 
                                periodId: existingPeriod.id, 
                                studentName: stud.fullName, 
                                periodNumber: period, 
                                dbAmount: Number(existingPeriod.amountDueOffice), 
                                excelAmount: amount, 
                                rowNumber: i, 
                                sourceSheet: "FINANCIALS" 
                            })
                        } else if (!existingPeriod) {
                            newFinancialPeriods.push({ studentId: stud.id, studentName: stud.fullName, periodNumber: period, amountDueOffice: amount, rowNumber: i, sourceSheet: "FINANCIALS" })
                        }
                    }
                }
            }

            // ── §5 Parse RAW PAYMENTS ────────────────────────
            const parseFinancialSheet = (sheet: ExcelJS.Worksheet | undefined, type: string) => {
                if (!sheet) return
                const m = mapHeaders(sheet)
                for (let i = 2; i <= sheet.rowCount; i++) {
                    const row = sheet.getRow(i)
                    const data: any = { type, rowNumber: i, sourceSheet: sheet.name }
                    Object.keys(m).forEach(key => {
                        const col = m[key]
                        if (key.includes("date")) data[key] = cellDate(row, col)
                        else if (key.includes("amount") || key.includes("due") || key.includes("paid") || key.includes("balance") || key.includes("period")) data[key] = cellNum(row, col)
                        else data[key] = cellStr(row, col)
                    })
                    newRawPayments.push(data)
                }
            }

            parseFinancialSheet(sheetStudentPayments, "STUDENT_PAYMENT")
            parseFinancialSheet(sheetSupervisorPayments, "SUPERVISOR_PAYMENT")
            parseFinancialSheet(sheetInvoices, "INVOICE")
            parseFinancialSheet(sheetLedgerEntries, "LEDGER_ENTRY")
            parseFinancialSheet(sheetStudentSupervisors, "STUDENT_SUPERVISOR")

            return NextResponse.json({
                studentsStats: { new: newUsers.length, updated: validData.studentsToUpdate.length },
                supervisorsStats: { new: newSupervisors.length, updated: supervisorUpdates.length },
                financialStats: { clean: newFinancialPeriods.length, conflicts: conflicts.length, raw: newRawPayments.length },
                newUsers, newSupervisors, newOffices, supervisorUpdates, conflicts, newFinancialPeriods, newRawPayments, validData, headlessUsers, ignoredRows: []
            })

        // ══════════════════════════════════════════
        // COMMIT PHASE
        // ══════════════════════════════════════════
        } else if (contentType.includes("application/json")) {
            const body = await request.json()
            const { newUsers, newSupervisors, newOffices, supervisorUpdates, resolutions, conflicts, newFinancialPeriods, newRawPayments, validData } = body
            const batchString = `IMP_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`

            await prisma.$transaction(async (tx) => {
                const batch = await (tx as any).importBatch.create({ data: { batchString, status: "COMPLETED" } })
                const supervisorMap = new Map<string, string>()
                const studentMap = new Map<string, string>()

                // 1. COMMIT OFFICES
                for (const off of (newOffices ?? [])) {
                    const hash = await bcrypt.hash(off.password || "Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: off.email, passwordHash: hash, role: "OFFICE", isActive: true,
                            officeMember: { create: { fullName: off.fullName, officeRole: off.officeRole || "ADMIN" } }
                        } as any
                    })
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "User", recordId: user.id, action: "CREATE", oldData: {}, newData: { email: off.email, role: "OFFICE" } } 
                    })
                }

                // 2. COMMIT SUPERVISORS (New & Updates)
                for (const sup of (newSupervisors ?? [])) {
                    const hash = await bcrypt.hash(sup.password || "Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: sup.email, passwordHash: hash, role: "SUPERVISOR", isActive: true,
                            supervisor: { create: { 
                                fullName: sup.fullName, 
                                email: sup.email, 
                                phone: sup.phone,
                                address: sup.address,
                                bacbId: sup.bacbId || "N/A", 
                                certificantNumber: sup.certificantNumber || "N/A",
                                credentialType: sup.credentialType, 
                                importBatchId: batch.id 
                            } }
                        } as any,
                        include: { supervisor: true } as any
                    })
                    const s = (user as any).supervisor
                    if (s) supervisorMap.set(s.fullName.toLowerCase().trim(), s.id)
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "User", recordId: user.id, action: "CREATE", oldData: {}, newData: { email: sup.email } } 
                    })
                }

                for (const supUpd of (supervisorUpdates ?? [])) {
                    const { id, rowNumber, sourceSheet, ...fields } = supUpd
                    const old = await tx.supervisor.findUnique({ where: { id } })
                    await tx.supervisor.update({ where: { id }, data: { ...fields, importBatchId: batch.id } as any })
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "Supervisor", recordId: id, action: "UPDATE", oldData: old, newData: fields } 
                    })
                }

                // Populate supervisor map for students
                const allSups = await tx.supervisor.findMany()
                allSups.forEach(s => supervisorMap.set(s.fullName.toLowerCase().trim(), s.id))

                // 3. COMMIT STUDENTS (New & Updates)
                for (const nu of (newUsers ?? [])) {
                    const hash = await bcrypt.hash(nu.password || "Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: nu.email, passwordHash: hash, role: "STUDENT", isActive: true,
                            student: { create: { 
                                fullName: nu.fullName, email: nu.email, bacbId: nu.bacbId || "", 
                                startDate: nu.fields.startDate ? new Date(nu.fields.startDate) : new Date(),
                                endDate: nu.fields.endDate ? new Date(nu.fields.endDate) : new Date(),
                                hoursPerMonth: nu.fields.hoursPerMonth, hoursToDo: nu.fields.hoursToDo,
                                credential: nu.fields.credential, phone: nu.fields.phone, status: nu.fields.status,
                                city: nu.fields.city, state: nu.fields.state, school: nu.fields.school, level: nu.fields.level,
                                supervisionPercentage: nu.fields.supervisionPercentage, supervisionType: nu.fields.supervisionType,
                                hoursToPay: nu.fields.hoursToPay, amountToPay: nu.fields.amountToPay,
                                vcsSequence: nu.fields.vcsSequence, assignedOptionPlan: nu.fields.assignedOptionPlan,
                                hoursTargetReg: nu.fields.hoursTargetReg, hoursTargetConc: nu.fields.hoursTargetConc,
                                independentHoursTarget: nu.fields.independentHoursTarget, totalAmountContract: nu.fields.totalAmountContract,
                                analystPaymentRate: nu.fields.analystPaymentRate, officePaymentRate: nu.fields.officePaymentRate,
                                supervisorId: nu.supervisorName ? supervisorMap.get(nu.supervisorName.toLowerCase().trim()) : null,
                                importBatchId: batch.id
                            } }
                        } as any,
                        include: { student: true } as any
                    })
                    const s = (user as any).student
                    if (s) studentMap.set(s.fullName.toLowerCase().trim(), s.id)
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "User", recordId: user.id, action: "CREATE", oldData: {}, newData: { email: nu.email } } 
                    })
                }

                for (const upd of (validData?.studentsToUpdate ?? [])) {
                    const { id, supervisorName, rowNumber, sourceSheet, ...fields } = upd
                    const old = await tx.student.findUnique({ where: { id } })
                    const supervisorId = supervisorName ? supervisorMap.get(supervisorName.toLowerCase().trim()) : undefined
                    await tx.student.update({ where: { id }, data: { ...fields, supervisorId, importBatchId: batch.id } as any })
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "Student", recordId: id, action: "UPDATE", oldData: old, newData: { ...fields, supervisorId } } 
                    })
                }

                // 4. COMMIT FINANCIALS
                for (const conflict of (conflicts ?? [])) {
                    const res = resolutions?.[conflict.id]
                    if (res === "ignore" || !res) continue
                    const old = await tx.financialPeriod.findUnique({ where: { id: conflict.periodId } })
                    if (!old) continue
                    const amount = res === "sum" ? Number(old.amountDueOffice) + Number(conflict.excelAmount) : Number(conflict.excelAmount)
                    await tx.financialPeriod.update({ where: { id: conflict.periodId }, data: { amountDueOffice: amount, importBatchId: batch.id } as any })
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "FinancialPeriod", recordId: conflict.periodId, action: "UPDATE", oldData: old, newData: { amountDueOffice: amount } } 
                    })
                }

                for (const fp of (newFinancialPeriods ?? [])) {
                    const studentId = fp.studentId || studentMap.get(fp.studentName?.toLowerCase().trim())
                    if (!studentId) continue
                    const created = await (tx as any).financialPeriod.upsert({
                        where: { studentId_periodNumber: { studentId, periodNumber: fp.periodNumber } },
                        update: { amountDueOffice: fp.amountDueOffice, importBatchId: batch.id },
                        create: { studentId, periodNumber: fp.periodNumber, amountDueOffice: fp.amountDueOffice, importBatchId: batch.id, monthYearLabel: `Periodo ${fp.periodNumber}` }
                    } as any)
                    await (tx as any).importLog.create({ 
                        data: { batchId: batch.id, tableName: "FinancialPeriod", recordId: created.id, action: "CREATE", oldData: {}, newData: created } 
                    })
                }

                // Helper to resolve IDs from mixed Name/ID targets
                const allStudents = await tx.student.findMany()
                const findStudentId = (target: string) => {
                    if (!target) return null
                    const clean = target.toLowerCase().trim()
                    // Try by ID directly first
                    const byId = allStudents.find(s => s.id === target || s.userId === target)
                    if (byId) return byId.id
                    // Try by Name
                    return studentMap.get(clean) || null
                }
                const findSupervisorId = (target: string) => {
                    if (!target) return null
                    const clean = target.toLowerCase().trim()
                    const byId = allSups.find(s => s.id === target || s.userId === target)
                    if (byId) return byId.id
                    return supervisorMap.get(clean) || null
                }

                const invoiceMap = new Map<string, string>()

                for (const rp of (newRawPayments ?? [])) {
                    if (rp.type === "INVOICE") {
                        const studentId = findStudentId(rp.studentid || rp.studentname)
                        if (!studentId) continue
                        const inv = await (tx as any).invoice.create({
                            data: {
                                id: rp.id && rp.id.length === 36 ? rp.id : undefined,
                                studentId,
                                invoiceDate: rp.invoicedate || new Date(),
                                amountDue: rp.amountdue || 0,
                                amountPaid: rp.amountpaid || 0,
                                status: (rp.status || "SENT") as any,
                                sentAt: rp.sentat,
                                createdAt: rp.createdat
                            }
                        })
                        if (rp.id) invoiceMap.set(rp.id, inv.id)
                    } else if (rp.type === "STUDENT_PAYMENT") {
                        const studentId = findStudentId(rp.studentid || rp.target)
                        if (!studentId) continue
                        await (tx as any).studentPayment.create({
                            data: {
                                studentId,
                                amount: rp.amount || 0,
                                paymentDate: rp.paymentdate || rp.date || new Date(),
                                paymentType: (rp.paymenttype || rp.paymentType || "ZELLE") as any,
                                notes: rp.notes,
                                importBatchId: batch.id
                            }
                        })
                    } else if (rp.type === "SUPERVISOR_PAYMENT") {
                        const supervisorId = findSupervisorId(rp.supervisorid || rp.supTarget)
                        const studentId = findStudentId(rp.studentid || rp.studTarget)
                        if (!supervisorId || !studentId) continue
                        await (tx as any).supervisorPayment.create({
                            data: {
                                supervisorId, studentId,
                                monthYear: rp.monthyear || rp.monthYear || new Date(),
                                amountDue: rp.amountdue || rp.amountDue || 0,
                                amountPaidThisMonth: rp.amountpaidthismonth || rp.amountPaid || 0,
                                amountAlreadyPaid: rp.amountalreadypaid || rp.amountAlreadyPaid || 0,
                                balanceDue: rp.balancedue || rp.balanceDue || 0,
                                importBatchId: batch.id
                            }
                        })
                    } else if (rp.type === "STUDENT_SUPERVISOR") {
                        const studentId = findStudentId(rp.studentid)
                        const supervisorId = findSupervisorId(rp.supervisorid)
                        if (studentId && supervisorId) {
                            await (tx as any).studentSupervisor.upsert({
                                where: { studentId_supervisorId: { studentId, supervisorId } },
                                update: { isPrimary: rp.isprimary === "true" || rp.isprimary === true },
                                create: { studentId, supervisorId, isPrimary: rp.isprimary === "true" || rp.isprimary === true }
                            })
                        }
                    } else if (rp.type === "LEDGER_ENTRY") {
                        const supervisorId = findSupervisorId(rp.supervisorid)
                        const studentId = findStudentId(rp.studentid)
                        const invId = rp.invoiceid ? (invoiceMap.get(rp.invoiceid) || rp.invoiceid) : null
                        if (supervisorId && studentId && invId) {
                            await (tx as any).supervisorLedgerEntry.create({
                                data: {
                                    invoiceId: invId, supervisorId, studentId,
                                    paymentFromStudent: rp.paymentfromstudent || 0,
                                    supervisorCapTotal: rp.supervisorcaptotal || 0,
                                    supervisorCapRemainingBefore: rp.supervisorcapremainingbefore || 0,
                                    supervisorPayout: rp.supervisorpayout || 0,
                                    officePayout: rp.officepayout || 0,
                                    supervisorCapRemainingAfter: rp.supervisorcapremainingafter || 0,
                                    payoutStatus: rp.payoutstatus || "PENDING"
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
