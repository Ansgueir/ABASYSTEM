/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Data Dictionary: Column mappings ────────────────────────────────────────
// Students sheet columns:
// B: Trainee Name | C: Supervisor Name | D: BACB ID | E: Credential
// G: Level | H: Phone | I: Email | K: Option Plan | L: Start Date | M: End Date
// N: Total Months | O: Reg Hours Target | P: Conc Hours Target | Q: Ind Hours Target
// R: Total Amount Contract | S: Amount to Analyst | T: Total Paid Office | U: Status
//
// Supervisors sheet columns:
// A: Supervisor Name | B: Email | C: BACB # | E: Qualification Level | H: Status 
// ─────────────────────────────────────────────────────────────────────────────

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

function isRowEmpty(row: ExcelJS.Row, startCol: number, endCol: number): boolean {
    for (let i = startCol; i <= endCol; i++) {
        if (cellStr(row, i)) return false
    }
    return true
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        // §1 SECURITY GATEWAY — Hard-coded identity lock
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

            const sheetStudents    = workbook.getWorksheet("Supervisados")
            const sheetSupervisors = workbook.getWorksheet("Parametros")
            const sheetFinancial   = workbook.getWorksheet("Cobros")

            if (!sheetStudents || !sheetSupervisors || !sheetFinancial) {
                const missing = []
                if (!sheetStudents) missing.push("'Supervisados'")
                if (!sheetSupervisors) missing.push("'Parametros'")
                if (!sheetFinancial) missing.push("'Cobros'")
                return NextResponse.json({
                    error: `RECHAZADO (422): Faltan pestañas obligatorias: [${missing.join(", ")}].`
                }, { status: 422 })
            }

            const existingStudents = await prisma.student.findMany({
                include: { user: true, financialPeriods: true, supervisor: true }
            })
            const existingSupervisors = await prisma.supervisor.findMany({
                include: { user: true }
            })
            const existingEmails = new Set(
                (await prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase().trim())
            )
            const claimedEmailsInBatch = new Map<string, { rowNumber: number; sheetName: string }>()

            const newUsers: any[] = []
            const newSupervisors: any[] = []
            const supervisorUpdates: any[] = []
            const conflicts: any[] = []
            const newFinancialPeriods: any[] = []
            const ignoredRows: { sheet: string; sourceSheet: string; rowNumber: number | string; data: string; reason: string }[] = []
            const headlessUsers: { name: string; sourceSheet: string; rowNumber: number | string; email: string; collisionType: string; collisionDetail: string }[] = []
            const validData: any = { studentsToUpdate: [], financialPeriodsToUpdate: [] }
            
            // ── §3 Parse Parametros (Supervisors) ───────────────────────────
            // Hard boundary: Start row 19, continue until Col C is empty
            for (let i = 19; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const supName = cellStr(row, "C")

                // END BOUNDARY: If primary cell (Name) is empty, stop reading this table
                if (!supName || supName.trim() === "") break

                const colA = cellStr(row, "A").toLowerCase()
                const colB = cellStr(row, "B").toLowerCase()
                
                // Ignorar filas con "Venmo", "Zelle", etc.
                if (
                    colA.includes("venmo") || colA.includes("zelle") || colA.includes("cashapp") ||
                    colB.includes("venmo") || colB.includes("zelle") || colB.includes("cashapp")
                ) continue

                const bacbId   = cellStr(row, "D") // BACB ID
                const certNum  = cellStr(row, "E") // Cert #
                const qual     = cellStr(row, "F") // Qualification

                if (supName.toLowerCase() === "supervisores" || supName.toLowerCase() === "supervisor") continue

                const existingSup = existingSupervisors.find(
                    s => s.fullName.toLowerCase().trim() === supName.toLowerCase().trim() || (bacbId && s.bacbId === bacbId)
                )

                if (existingSup) {
                    const updates: any = { sourceSheet: "Parametros", rowNumber: i }
                    if (bacbId && existingSup.bacbId !== bacbId) updates.bacbId = bacbId
                    if (certNum && existingSup.certificantNumber !== certNum) updates.certificantNumber = certNum
                    if (qual && existingSup.credentialType !== qual) updates.qualificationLevel = qual
                    
                    if (Object.keys(updates).length > 2) { 
                        supervisorUpdates.push({ id: existingSup.id, ...updates })
                    }
                } else {
                    let finalSupEmail = ""
                    const potentialEmail = cellStr(row, "B")
                    if (potentialEmail.includes("@")) {
                        finalSupEmail = potentialEmail.toLowerCase()
                    }

                    if (!finalSupEmail || existingEmails.has(finalSupEmail) || claimedEmailsInBatch.has(finalSupEmail)) {
                        finalSupEmail = `${supName.toLowerCase().replace(/\s+/g, ".")}@pending.import`
                    }
                    claimedEmailsInBatch.set(finalSupEmail, { rowNumber: i, sheetName: "Parametros" })

                    newSupervisors.push({
                        fullName: supName,
                        bacbId,
                        certificantNumber: certNum,
                        qualificationLevel: qual || "BCBA",
                        email: finalSupEmail,
                        status: "ACTIVE",
                        sourceSheet: "Parametros",
                        rowNumber: i
                    })
                }
            }

            // ── §4 Parse Supervisados (Students) ────────────────────────────
            const studentLatestRows = new Map<string, any>()
            for (let i = 2; i <= sheetStudents.rowCount; i++) {
                const row = sheetStudents.getRow(i)
                const traineeNameRaw = cellStr(row, "B")
                
                // END BOUNDARY: Stop if name is empty
                if (!traineeNameRaw || traineeNameRaw.trim() === "") break
                
                const traineeName = traineeNameRaw.toLowerCase().trim()
                const bacbId      = cellStr(row, "D")
                const startDateStr = cellDate(row, "L") ?? new Date(0)
                
                const identityKey  = `${bacbId}_${traineeName}`
                const existing = studentLatestRows.get(identityKey)
                if (!existing) {
                    studentLatestRows.set(identityKey, { rowNumber: i, row, startDateStr, traineeName, bacbId, allRowNumbers: [i] })
                } else {
                    existing.allRowNumbers.push(i)
                    if (startDateStr > existing.startDateStr) {
                        Object.assign(existing, { rowNumber: i, row, startDateStr, traineeName, bacbId })
                    }
                }
            }

            const mergedRecords: any[] = []
            for (const [, data] of studentLatestRows.entries()) {
                const { row, startDateStr, traineeName, bacbId, rowNumber, allRowNumbers } = data
                if (allRowNumbers.length > 1) mergedRecords.push({ bacbId, traineeName, allRowNumbers })

                const existingStudent = existingStudents.find(
                    s => s.bacbId === bacbId && s.fullName.toLowerCase().trim() === traineeName
                )

                const supervisorName        = cellStr(row, "C")
                const fields = {
                    vcsSequence:           cellStr(row, "F") || null,
                    level:                 cellStr(row, "G") || null,
                    phone:                 cellStr(row, "H") || null,
                    optionPlan:            cellStr(row, "K") || null,
                    endDate:               cellDate(row, "M"),
                    totalMonths:           cellNum(row, "N") || null,
                    regularHoursTarget:    cellNum(row, "O") || null, // Horas Regulares
                    concentratedHoursTarget: cellNum(row, "P") || null, // Horas Concentradas
                    independentHoursTarget: cellNum(row, "Q") || null, // Horas Independientes
                    totalAmountContract:   cellNum(row, "R") || null, // Monto Total Supervisión
                    analystPaymentRate:    cellNum(row, "S") || null, // Monto a Pagar Analista
                    officePaymentRate:     cellNum(row, "T") || null, // Total Pagado Oficina
                    credential:            cellStr(row, "E") || null,
                    status:                cellStr(row, "U") || null
                }

                const displayRow = allRowNumbers.length > 1 
                    ? `Filas ${allRowNumbers.join(", ")}` 
                    : rowNumber

                if (!existingStudent) {
                    const rawEmail = cellStr(row, "I").toLowerCase()
                    let assignedEmail: string | null = null
                    if (rawEmail && !existingEmails.has(rawEmail) && !claimedEmailsInBatch.has(rawEmail)) {
                        assignedEmail = rawEmail
                        claimedEmailsInBatch.set(rawEmail, { rowNumber, sheetName: "Supervisados" })
                    } else {
                        let collisionType = "EMAIL_EMPTY", collisionDetail = "Email Vacío"
                        if (rawEmail) {
                            if (existingEmails.has(rawEmail)) {
                                collisionType = "EMAIL_IN_DB"; collisionDetail = "Email ya existe en BD"
                            } else {
                                const origin = claimedEmailsInBatch.get(rawEmail)
                                collisionType = "EMAIL_DUPLICATE_IN_FILE"
                                collisionDetail = `Duplicado con Fila ${origin?.rowNumber} (${origin?.sheetName})`
                            }
                        }
                        headlessUsers.push({ 
                            name: cellStr(row, "B"), 
                            rowNumber: displayRow, 
                            sourceSheet: "Supervisados",
                            email: rawEmail || "(none)", 
                            collisionType, 
                            collisionDetail 
                        })
                    }

                    newUsers.push({
                        role: "STUDENT",
                        fullName: cellStr(row, "B"),
                        bacbId,
                        email: assignedEmail,
                        supervisorName,
                        _rowNumber: displayRow,
                        rowNumber: displayRow,
                        sourceSheet: "Supervisados",
                        startDate: startDateStr.getTime() === 0 ? null : startDateStr,
                        ...fields
                    })
                } else {
                    const updates: any = { supervisorName, sourceSheet: "Supervisados", rowNumber: displayRow } 
                    Object.entries(fields).forEach(([k, v]) => {
                        if (v !== null && (existingStudent as any)[k] === null) updates[k] = v
                    })
                    validData.studentsToUpdate.push({ id: existingStudent.id, ...updates })
                }
            }

            // ── §5 Parse Cobros (Payments History) ──────────────────────────
            // Hard boundary: Start row 27, continue until Col L is empty
            for (let i = 27; i <= sheetFinancial.rowCount; i++) {
                const row = sheetFinancial.getRow(i)
                const traineeNameRaw = cellStr(row, "L").toLowerCase()

                // END BOUNDARY: If primary student name col is empty, stop
                if (!traineeNameRaw || traineeNameRaw.trim() === "" || traineeNameRaw === "supervisado") break

                const traineeName = traineeNameRaw.trim()
                const existingStudent = existingStudents.find(s => s.fullName.toLowerCase().trim() === traineeName)

                // Iteración horizontal M (13) hasta BJ (62)
                for (let col = 13; col <= 62; col++) {
                    const amount = cellNum(row, col)
                    if (amount === 0) continue
                    const periodNum = col - 12
                    
                    const rowData = {
                        periodNumber: periodNum,
                        monthYearLabel: `Periodo ${periodNum}`,
                        amountDueOffice: amount,
                        amountDueAnalyst: 0,
                        accumulatedDueOffice: 0,
                        accumulatedPaidOffice: 0,
                        accumulatedPaidAnalyst: 0,
                        sourceSheet: "Cobros",
                        rowNumber: i
                    }

                    if (existingStudent) {
                        const existingPeriod = existingStudent.financialPeriods.find(p => p.periodNumber === periodNum)
                        if (existingPeriod && Number(existingPeriod.amountDueOffice || 0) !== amount) {
                            conflicts.push({
                                id: `CFL-${existingPeriod.id}`, 
                                periodId: existingPeriod.id, 
                                studentName: existingStudent.fullName,
                                type: "Injected", 
                                periodNumber: periodNum, 
                                month: `Periodo ${periodNum}`,
                                dbAmount: Number(existingPeriod.amountDueOffice), 
                                excelAmount: amount, 
                                field: "amountDueOffice",
                                sourceSheet: "Cobros",
                                rowNumber: i
                            })
                        } else if (!existingPeriod) {
                            newFinancialPeriods.push({ studentName: traineeName, studentId: existingStudent.id, ...rowData })
                        }
                    } else {
                        newFinancialPeriods.push({ studentName: traineeName, ...rowData })
                    }
                }
            }

            // ── §6 Parse Base Datos / Tesoreria (Transactions) ──────────────
            const sheetTesoreria = workbook.getWorksheet("Base Datos") || workbook.getWorksheet("Tesoreria")
            const newPayments: any[] = []
            if (sheetTesoreria) {
                // Hard boundary: Start row 2, stop when Col B is empty
                for (let i = 2; i <= sheetTesoreria.rowCount; i++) {
                    const row = sheetTesoreria.getRow(i)
                    const traineeNameRaw = cellStr(row, "B").toLowerCase()

                    if (!traineeNameRaw || traineeNameRaw.trim() === "") break

                    const traineeName = traineeNameRaw.trim()
                    const amount = cellNum(row, "C")
                    const method = cellStr(row, "D")
                    const notes = cellStr(row, "E")

                    if (amount === 0) continue

                    newPayments.push({
                        studentName: traineeName,
                        amount,
                        paymentDate: cellDate(row, "A") || new Date(),
                        paymentType: method.toUpperCase().replace(/\s+/g, "_"),
                        notes: notes || `Importado desde ${sheetTesoreria.name}`,
                        sourceSheet: sheetTesoreria.name,
                        rowNumber: i
                    })
                }
            }

            return NextResponse.json({
                ignoredRows,
                skippedRowsCount: ignoredRows.length,
                studentsStats: { new: newUsers.length, updated: validData.studentsToUpdate.length },
                supervisorsStats: { new: newSupervisors.length, updated: supervisorUpdates.length },
                financialStats: { clean: newFinancialPeriods.length, conflicts: conflicts.length },
                transactionStats: { new: newPayments.length },
                newUsers,
                newSupervisors,
                supervisorUpdates,
                conflicts,
                newFinancialPeriods,
                newPayments,
                validData,
                mergedRecords,
                headlessUsers
            })

        // ══════════════════════════════════════════
        // COMMIT PHASE
        // ══════════════════════════════════════════
        } else if (contentType.includes("application/json")) {
            const body = await request.json()
            const { newUsers, newSupervisors, supervisorUpdates, resolutions, conflicts, newFinancialPeriods, validData } = body
            const batchString = `IMP_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`

            await prisma.$transaction(async (tx) => {
                const batch = await (tx as any).importBatch.create({ data: { batchString, status: "COMPLETED" } })
                const supervisorMap = new Map<string, string>() 
                const studentMap = new Map<string, string>() 

                for (const sup of (newSupervisors ?? [])) {
                    const hash = await bcrypt.hash("Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: sup.email, passwordHash: hash, role: "SUPERVISOR", isActive: true,
                            requiresWizard: true, isFirstLogin: true, inviteSent: false,
                            supervisor: {
                                create: {
                                    fullName: sup.fullName, phone: "PENDING", address: "Imported", email: sup.email,
                                    bacbId: sup.bacbId || "N/A", certificantNumber: sup.certificantNumber || "N/A",
                                    status: (sup.status || "ACTIVE") as any, credentialType: (sup.qualificationLevel || "BCBA") as any,
                                    importBatchId: batch.id
                                }
                            }
                        },
                        include: { supervisor: true }
                    })
                    const s = (user as any).supervisor
                    if (s) supervisorMap.set(s.fullName.toLowerCase().trim(), s.id)
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "User", recordId: user.id, action: "CREATE", oldData: {}, newData: { id: user.id, fullName: sup.fullName } }
                    })
                }

                for (const supUpd of (supervisorUpdates ?? [])) {
                    const { id, ...fields } = supUpd
                    const old = await tx.supervisor.findUnique({ where: { id } })
                    await tx.supervisor.update({ where: { id }, data: { ...fields, importBatchId: batch.id } })
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "Supervisor", recordId: id, action: "UPDATE", oldData: old, newData: fields }
                    })
                }

                const allSups = await tx.supervisor.findMany()
                allSups.forEach(s => supervisorMap.set(s.fullName.toLowerCase().trim(), s.id))

                for (const update of (validData?.studentsToUpdate ?? [])) {
                    const { id, supervisorName, ...fields } = update
                    const old = await tx.student.findUnique({ where: { id } })
                    const supervisorId = supervisorName ? supervisorMap.get(supervisorName.toLowerCase().trim()) : undefined
                    await tx.student.update({ where: { id }, data: { ...fields, supervisorId, importBatchId: batch.id } })
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "Student", recordId: id, action: "UPDATE", oldData: old, newData: { ...fields, supervisorId } }
                    })
                }

                const usedEmails = new Set<string>()
                for (const newUser of (newUsers ?? [])) {
                    const hash = await bcrypt.hash("Aba12345*", 10)
                    let email = newUser.email?.trim().toLowerCase()
                    if (!email || usedEmails.has(email)) {
                        email = `${String(newUser.fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)}_${Date.now()}@pending.import`
                    }
                    usedEmails.add(email)

                    const user = await tx.user.create({
                        data: {
                            email, passwordHash: hash, role: "STUDENT", isActive: true,
                            requiresWizard: true, isFirstLogin: true, inviteSent: false,
                            student: {
                                create: {
                                    fullName: newUser.fullName, 
                                    bacbId: newUser.bacbId ?? "", 
                                    phone: newUser.phone ?? "", 
                                    email,
                                    startDate: newUser.startDate ? new Date(newUser.startDate) : new Date(),
                                    endDate: newUser.endDate ? new Date(newUser.endDate) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                                    credential: (newUser.credential || "NO_CREDENTIAL") as any,
                                    level: (newUser.level || "BCBA") as any,
                                    school: "Imported", 
                                    city: "N/A", 
                                    state: "FL", 
                                    totalMonths: newUser.totalMonths ?? 0,
                                    supervisionType: "REGULAR",
                                    supervisionPercentage: 0.05,
                                    hoursToDo: 130,
                                    hoursToPay: 0,
                                    amountToPay: 0,
                                    hoursPerMonth: 130,
                                    vcsSequence: newUser.vcsSequence ?? null, 
                                    assignedOptionPlan: (newUser.optionPlan || "A") as any,
                                    regularHoursTarget: newUser.regularHoursTarget ?? null, 
                                    concentratedHoursTarget: newUser.concentratedHoursTarget ?? null,
                                    independentHoursTarget: newUser.independentHoursTarget ?? null, 
                                    totalAmountContract: newUser.totalAmountContract ?? null,
                                    analystPaymentRate: newUser.analystPaymentRate ?? null, 
                                    officePaymentRate: newUser.officePaymentRate ?? null,
                                    supervisorId: newUser.supervisorName ? supervisorMap.get(newUser.supervisorName.toLowerCase().trim()) : null,
                                    importBatchId: batch.id
                                }
                            }
                        },
                        include: { student: true }
                    })
                    const s = (user as any).student
                    if (s) studentMap.set(s.fullName.toLowerCase().trim(), s.id)
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "User", recordId: user.id, action: "CREATE", oldData: {}, newData: { id: user.id, email } }
                    })
                }

                const allStuds = await tx.student.findMany()
                allStuds.forEach(s => studentMap.set(s.fullName.toLowerCase().trim(), s.id))

                for (const conflict of (conflicts ?? [])) {
                    const res = resolutions?.[conflict.id]
                    if (res === "ignore" || !res) continue
                    const old = await tx.financialPeriod.findUnique({ where: { id: conflict.periodId } })
                    if (!old) continue
                    const amount = res === "sum" ? Number(old.amountDueOffice) + Number(conflict.excelAmount) : Number(conflict.excelAmount)
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "FinancialPeriod", recordId: conflict.periodId, action: "UPDATE", oldData: old, newData: { ...old, amountDueOffice: amount } }
                    })
                    await tx.financialPeriod.update({ where: { id: conflict.periodId }, data: { amountDueOffice: amount, importBatchId: batch.id } })
                }

                for (const fp of (newFinancialPeriods ?? [])) {
                    const studentId = fp.studentId || studentMap.get(fp.studentName?.toLowerCase().trim())
                    if (!studentId) continue
                    const created = await (tx as any).financialPeriod.upsert({
                        where: { studentId_periodNumber: { studentId, periodNumber: fp.periodNumber } },
                        update: { amountDueOffice: fp.amountDueOffice, importBatchId: batch.id },
                        create: { ...fp, studentId, importBatchId: batch.id }
                    })
                    await (tx as any).importLog.create({
                        data: { batchId: batch.id, tableName: "FinancialPeriod", recordId: created.id, action: "CREATE", oldData: {}, newData: created }
                    })
                }
            }, { maxWait: 20000, timeout: 180000 })
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
