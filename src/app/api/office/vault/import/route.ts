/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// ─── Data Dictionary: Column mappings (export-master parity) ────────────────
// Students sheet columns (A=1, B=2 ... L=12, etc.)
// A: Cons | B: Trainee Name | C: Supervisor Name | D: BACB ID | E: Credential
// F: VCS Sequence | G: Level | H: Phone | I: Email | J: City/State
// K: Option Plan | L: Start Date | M: End Date | N: Total Months
// O: Regular Hours Target | P: Concentrated Hours Target | Q: Independent Hours Target
// R: Total Amount Contract | S: Amount to Analyst | T: Total Paid Office | U: Status | V: Comment
//
// Supervisors sheet columns:
// A: Supervisor Name | B: Internal ID | C: BACB ID | D: Cert # | E: Qualification Level
// F: Date Qualified | G: Exam Date | H: Status | I: Active Students Count
//
// Financial History sheet columns:
// A: Student Name | B: Supervisor Name | C: Period # | D: Month
// E: Due to Office | F: Due to Office Acum | G: Paid to Office | H: Paid to Office Acum
// I: Due to Analyst | J: Due to Analyst Acum | K: Paid to Analyst | L: Paid to Analyst Acum
// ─────────────────────────────────────────────────────────────────────────────

function cellStr(row: ExcelJS.Row, col: string | number): string {
    const cell = row.getCell(col)
    const v = cell.value
    if (v === null || v === undefined) return ""

    // ExcelJS rich-text object: { richText: [{text: "..."}] }
    if (typeof v === "object" && !Array.isArray(v) && "richText" in (v as any)) {
        return ((v as any).richText as any[]).map((r: any) => r.text ?? "").join("").trim()
    }

    // ExcelJS hyperlink object: { text: "label", hyperlink: "url" }
    if (typeof v === "object" && !Array.isArray(v) && "text" in (v as any)) {
        return String((v as any).text ?? "").trim()
    }

    // ExcelJS formula result: { formula: "=", result: "value" }
    if (typeof v === "object" && !Array.isArray(v) && "result" in (v as any)) {
        return String((v as any).result ?? "").trim()
    }

    // Shared string that somehow became an array (edge case)
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

            // §2 Multi-sheet strict names (Supervisees Info spec)
            const sheetStudents    = workbook.getWorksheet("Supervisados")
            const sheetSupervisors = workbook.getWorksheet("Parametros")
            const sheetFinancial   = workbook.getWorksheet("Cobros")

            const detectedSheets = workbook.worksheets.map(s => s.name)
            console.log("Pestañas encontradas:", detectedSheets)

            if (!sheetStudents || !sheetSupervisors || !sheetFinancial) {
                const missing = []
                if (!sheetStudents) missing.push("'Supervisados'")
                if (!sheetSupervisors) missing.push("'Parametros'")
                if (!sheetFinancial) missing.push("'Cobros'")
                return NextResponse.json({
                    error: `RECHAZADO (422): Faltan pestañas obligatorias: [${missing.join(", ")}].`
                }, { status: 422 })
            }

            // Debug de Lectura: Console Logs (REQUIRED BY SPEC)
            console.log("Headers detectados en Parametros (Fila 18):", sheetSupervisors.getRow(18).values)
            console.log("Headers detectados en Supervisados (Fila 1):", sheetStudents.getRow(1).values)
            console.log("Headers detectados en Cobros (Fila 27):", sheetFinancial.getRow(27).values)

            // §2 Pre-load existing records
            const existingStudents = await prisma.student.findMany({
                include: { user: true, financialPeriods: true, supervisor: true }
            })
            const existingSupervisors = await prisma.supervisor.findMany({
                include: { user: true }
            })

            // Pre-fetch existing emails for First-In dedup policy
            const existingEmails = new Set(
                (await prisma.user.findMany({ select: { email: true } })).map(u => u.email.toLowerCase().trim())
            )
            // Track emails already claimed in THIS batch: email -> {rowNumber, sheetName}
            const claimedEmailsInBatch = new Map<string, { rowNumber: number; sheetName: string }>()

            const newUsers: any[] = []
            const newSupervisors: any[] = []
            const supervisorUpdates: any[] = []
            const conflicts: any[] = []
            const newFinancialPeriods: any[] = []
            const ignoredRows: { rowNumber: number; name: string; reason: string }[] = []
            const headlessUsers: { name: string; rowNumber: number; email: string; collisionType: string; collisionDetail: string }[] = []
            const validData: any = { studentsToUpdate: [], financialPeriodsToUpdate: [] }
            
            const financialDataByStudent = new Map<string, any[]>()

            // ── §3 Parse Parametros (Supervisors) ───────────────────────────
            // SPEC: Starts at Row 19 (Header 18)
            sheetSupervisors.eachRow((row, rowNumber) => {
                if (rowNumber <= 18) return
                const supName  = cellStr(row, "A") // Names of Supervisors
                if (!supName) return

                const rawEmail = cellStr(row, "B").toLowerCase() // Email
                const bacbId   = cellStr(row, "C") // BACB #
                // We use defaults for others if not in the 3-col spec provided
                const status   = "ACTIVE"

                const existingSup = existingSupervisors.find(
                    s => s.fullName.toLowerCase().trim() === supName.toLowerCase().trim() || (bacbId && s.bacbId === bacbId)
                )

                if (existingSup) {
                    const updates: any = {}
                    // Sync only if empty or different
                    if (bacbId && existingSup.bacbId !== bacbId) updates.bacbId = bacbId
                    if (Object.keys(updates).length > 0) {
                        supervisorUpdates.push({ id: existingSup.id, ...updates })
                    }
                } else {
                    let finalSupEmail = rawEmail
                    if (!finalSupEmail || existingEmails.has(finalSupEmail) || claimedEmailsInBatch.has(finalSupEmail)) {
                        finalSupEmail = `${supName.toLowerCase().replace(/\s+/g, ".")}@pending.import`
                    }
                    claimedEmailsInBatch.set(finalSupEmail, { rowNumber, sheetName: "Parametros" })

                    newSupervisors.push({
                        fullName: supName,
                        bacbId,
                        email: finalSupEmail,
                        status,
                        qualificationLevel: "BCBA" // Default
                    })
                }
            })

            // ── §4 Parse Supervisados (Students) ────────────────────────────
            // SPEC: Header Row 1
            const studentLatestRows = new Map<string, any>()

            sheetStudents.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return
                const traineeName = cellStr(row, "B").toLowerCase()
                const startDateStr = cellDate(row, "L") ?? new Date(0)
                const bacbId      = cellStr(row, "D")
                
                if (startDateStr.getFullYear() > 0 && startDateStr.getFullYear() < 2026) {
                    ignoredRows.push({ rowNumber, name: cellStr(row, "B"), reason: `Date before 2026 filter (${startDateStr.getFullYear()})` })
                    return
                }
                if (!traineeName) {
                    ignoredRows.push({ rowNumber, name: cellStr(row, "B") || "(empty)", reason: "Empty Trainee Name" })
                    return
                }

                const identityKey  = `${bacbId}_${traineeName}`
                const existing = studentLatestRows.get(identityKey)
                if (!existing) {
                    studentLatestRows.set(identityKey, { rowNumber, row, startDateStr, traineeName, bacbId, allRowNumbers: [rowNumber] })
                } else {
                    existing.allRowNumbers.push(rowNumber)
                    if (startDateStr > existing.startDateStr) {
                        Object.assign(existing, { rowNumber, row, startDateStr, traineeName, bacbId })
                    }
                }
            })

            const mergedRecords: any[] = []

            for (const [, data] of studentLatestRows.entries()) {
                const { row, startDateStr, traineeName, bacbId, rowNumber, allRowNumbers } = data

                if (allRowNumbers.length > 1) {
                    mergedRecords.push({ bacbId, traineeName, allRowNumbers })
                }

                const existingStudent = existingStudents.find(
                    s => s.bacbId === bacbId && s.fullName.toLowerCase().trim() === traineeName
                )

                const supervisorName        = cellStr(row, "C") // SPEC: Relational
                const vcsSequence           = cellStr(row, "F") || null
                const level                 = cellStr(row, "G") || null
                const phone                 = cellStr(row, "H") || null
                const optionPlan            = cellStr(row, "K") || null
                const endDate               = cellDate(row, "M")
                const totalMonths           = cellNum(row, "N") || null
                const regHoursTarget        = cellNum(row, "O") || null
                const concHoursTarget       = cellNum(row, "P") || null
                const indHoursTarget        = cellNum(row, "Q") || null
                const totalAmountContract   = cellNum(row, "R") || null
                const analystRate           = cellNum(row, "S") || null
                const officeRate            = cellNum(row, "T") || null
                const credential            = cellStr(row, "E") || null
                const status                = cellStr(row, "U") || null

                if (!existingStudent) {
                    const rawEmail = cellStr(row, "I").toLowerCase()
                    let assignedEmail: string | null = null
                    if (rawEmail && !existingEmails.has(rawEmail) && !claimedEmailsInBatch.has(rawEmail)) {
                        assignedEmail = rawEmail
                        claimedEmailsInBatch.set(rawEmail, { rowNumber, sheetName: "Supervisados" })
                    } else {
                        let collisionType: string
                        let collisionDetail: string
                        if (!rawEmail) {
                            collisionType = "EMAIL_EMPTY"; collisionDetail = "Email Vacío"
                        } else if (existingEmails.has(rawEmail)) {
                            collisionType = "EMAIL_IN_DB"; collisionDetail = "Email ya existe en BD"
                        } else {
                            const origin = claimedEmailsInBatch.get(rawEmail)
                            collisionType = "EMAIL_DUPLICATE_IN_FILE"
                            collisionDetail = `Duplicado con Fila ${origin?.rowNumber} (${origin?.sheetName})`
                        }
                        headlessUsers.push({ name: cellStr(row, "B"), rowNumber, email: rawEmail || "(none)", collisionType, collisionDetail })
                    }

                    newUsers.push({
                        role:                 "STUDENT",
                        fullName:             cellStr(row, "B"),
                        bacbId,
                        email:                assignedEmail,
                        supervisorName, // Pass for relational commit
                        _rowNumber:           rowNumber,
                        phone,
                        startDate:            startDateStr.getTime() === 0 ? null : startDateStr,
                        endDate,
                        totalMonths,
                        vcsSequence,
                        optionPlan,
                        level,
                        credential,
                        regHoursTarget,
                        concHoursTarget,
                        indHoursTarget,
                        totalAmountContract,
                        analystPaymentRate: analystRate,
                        officePaymentRate: officeRate,
                        status
                    })
                } else {
                    const updates: any = { supervisorName } // Always try to sync supervisor if possible
                    if (phone          && !existingStudent.phone)          updates.phone          = phone
                    if (vcsSequence    && !existingStudent.vcsSequence)    updates.vcsSequence    = vcsSequence
                    if (totalMonths    && !existingStudent.totalMonths)    updates.totalMonths    = totalMonths
                    if (regHoursTarget && !existingStudent.regularHoursTarget)    updates.regularHoursTarget    = regHoursTarget
                    if (concHoursTarget && !existingStudent.concentratedHoursTarget) updates.concentratedHoursTarget = concHoursTarget
                    if (indHoursTarget && !existingStudent.independentHoursTarget) updates.independentHoursTarget = indHoursTarget
                    if (totalAmountContract && !existingStudent.totalAmountContract) updates.totalAmountContract = totalAmountContract
                    if (analystRate && !existingStudent.analystPaymentRate) updates.analystPaymentRate = analystRate
                    if (officeRate  && !existingStudent.officePaymentRate)  updates.officePaymentRate  = officeRate
                    if (endDate && !existingStudent.endDate) updates.endDate = endDate

                    validData.studentsToUpdate.push({ id: existingStudent.id, ...updates })
                }
            }

            // ── §5 Parse Cobros (Payments) ──────────────────────────────────
            // SPEC: Header Row 27. Horizontal Periods from Column G (7) onwards.
            sheetFinancial.eachRow((row, rowNumber) => {
                if (rowNumber <= 27) return
                const traineeName = cellStr(row, "A").toLowerCase()
                if (!traineeName) return

                const existingStudent = existingStudents.find(
                    s => s.fullName.toLowerCase().trim() === traineeName
                )

                // Period identification from Col G (7) to roughly AV (48 periods)
                for (let col = 7; col <= 60; col++) {
                    const amount = cellNum(row, col)
                    if (amount === 0) continue

                    const periodNum = col - 6 // Col 7 = Period 1
                    const periodLabel = `Periodo ${periodNum}`

                    const rowData = {
                        periodNumber: periodNum,
                        monthYearLabel: periodLabel,
                        amountDueOffice: amount,
                        amountDueAnalyst: 0, // Not horizontal in provided spec
                        accumulatedDueOffice: 0,
                        accumulatedPaidOffice: 0,
                        accumulatedPaidAnalyst: 0
                    }

                    if (!financialDataByStudent.has(traineeName)) financialDataByStudent.set(traineeName, [])
                    financialDataByStudent.get(traineeName)!.push(rowData)

                    if (existingStudent) {
                        const existingPeriod = existingStudent.financialPeriods.find(p => p.periodNumber === periodNum)
                        if (existingPeriod) {
                            if (Number(existingPeriod.amountDueOffice || 0) !== amount) {
                                conflicts.push({
                                    id: `CFL-${existingPeriod.id}`, periodId: existingPeriod.id, studentName: existingStudent.fullName,
                                    type: "Injected", periodNumber: periodNum, month: periodLabel,
                                    dbAmount: Number(existingPeriod.amountDueOffice), excelAmount: amount, field: "amountDueOffice"
                                })
                            }
                        } else {
                            newFinancialPeriods.push({ studentName: traineeName, studentId: existingStudent.id, ...rowData })
                        }
                    } else {
                        newFinancialPeriods.push({ studentName: traineeName, ...rowData })
                    }
                }
            })

            return NextResponse.json({
                ignoredRows,
                skippedRowsCount: ignoredRows.length,
                studentsDetected: newUsers.length,
                supervisorsDetected: newSupervisors.length + supervisorUpdates.length,
                newUsers,
                newSupervisors,
                supervisorUpdates,
                conflicts,
                newFinancialPeriods,
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
                // 1. Create ImportBatch
                const batch = await (tx as any).importBatch.create({
                    data: { batchString, status: "COMPLETED" }
                })

                const supervisorMap = new Map<string, string>() // normalized name -> id
                const studentMap = new Map<string, string>() // normalized name -> id

                // 2. Paso A: Create/Update Supervisors
                for (const sup of (newSupervisors ?? [])) {
                    const hash = await bcrypt.hash("Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: sup.email,
                            passwordHash: hash,
                            role: "SUPERVISOR",
                            isActive: true,
                            requiresWizard: true,
                            isFirstLogin: true,
                            supervisor: {
                                create: {
                                    fullName: sup.fullName,
                                    phone: "PENDING",
                                    address: "Imported",
                                    email: sup.email,
                                    bacbId: sup.bacbId || "N/A",
                                    certificantNumber: sup.certificantNumber || "N/A",
                                    dateQualified: sup.dateQualified ? new Date(sup.dateQualified) : null,
                                    examDate: sup.examDate ? new Date(sup.examDate) : null,
                                    status: (sup.status || "ACTIVE") as any,
                                    credentialType: (sup.qualificationLevel || "BCBA") as any,
                                    // @ts-ignore
                                    importBatchId: batch.id
                                }
                            }
                        },
                        include: { supervisor: true }
                    })
                    const s = (user as any).supervisor
                    if (s) supervisorMap.set(s.fullName.toLowerCase().trim(), s.id)
                    
                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "User",
                            recordId: user.id,
                            action: "CREATE",
                            oldData: {},
                            newData: { id: user.id, fullName: sup.fullName } as any
                        }
                    })
                }

                for (const supUpd of (supervisorUpdates ?? [])) {
                    const { id, ...fields } = supUpd
                    const old = await tx.supervisor.findUnique({ where: { id } })
                    await tx.supervisor.update({ where: { id }, data: fields })
                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "Supervisor",
                            recordId: id,
                            action: "UPDATE",
                            oldData: old as any,
                            newData: fields as any
                        }
                    })
                }

                // Fill map with all existing supervisors
                const currentSups = await tx.supervisor.findMany()
                currentSups.forEach(s => supervisorMap.set(s.fullName.toLowerCase().trim(), s.id))

                // 3. Paso B: Create/Update Students
                // Update existing
                for (const update of (validData?.studentsToUpdate ?? [])) {
                    const { id, supervisorName, ...fields } = update
                    const old = await tx.student.findUnique({ where: { id } })
                    
                    const supervisorId = supervisorName ? supervisorMap.get(supervisorName.toLowerCase().trim()) : undefined
                    
                    await tx.student.update({ 
                        where: { id }, 
                        data: { ...fields, supervisorId } 
                    })
                    
                    if (old) studentMap.set(old.fullName.toLowerCase().trim(), id)
                    
                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "Student",
                            recordId: id,
                            action: "UPDATE",
                            oldData: old as any,
                            newData: { ...fields, supervisorId } as any
                        }
                    })
                }

                // Create new
                const usedEmailsInTx = new Set<string>()
                for (const newUser of (newUsers ?? [])) {
                    const hash = await bcrypt.hash("Aba12345*", 10)
                    let finalEmail = newUser.email ? newUser.email.trim().toLowerCase() : null
                    if (!finalEmail || usedEmailsInTx.has(finalEmail)) {
                        const safeName = String(newUser.fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
                        finalEmail = `${safeName}_${Date.now()}_${Math.floor(Math.random() * 9999)}@pending.import`
                    }
                    usedEmailsInTx.add(finalEmail)

                    const user = await tx.user.create({
                        data: {
                            email: finalEmail,
                            passwordHash: hash,
                            role: "STUDENT",
                            isActive: true,
                            requiresWizard: true,
                            isFirstLogin: true,
                            student: {
                                create: {
                                    fullName: newUser.fullName,
                                    bacbId: newUser.bacbId ?? "",
                                    phone: newUser.phone ?? "",
                                    email: finalEmail,
                                    startDate: new Date(newUser.startDate || new Date()),
                                    endDate: newUser.endDate ? new Date(newUser.endDate) : new Date(),
                                    credential: (newUser.credential || "NO_CREDENTIAL") as any,
                                    level: (newUser.level || "BCBA") as any,
                                    school: "Imported",
                                    city: "N/A",
                                    state: "FL",
                                    supervisionType: "REGULAR",
                                    supervisionPercentage: 0,
                                    hoursToDo: 0,
                                    hoursToPay: 0,
                                    amountToPay: 0,
                                    hoursPerMonth: 0,
                                    totalMonths: newUser.totalMonths ?? 0,
                                    vcsSequence: newUser.vcsSequence ?? null,
                                    assignedOptionPlan: (newUser.optionPlan || "A") as any,
                                    regularHoursTarget: newUser.regHoursTarget ?? null,
                                    concentratedHoursTarget: newUser.concHoursTarget ?? null,
                                    independentHoursTarget: newUser.indHoursTarget ?? null,
                                    totalAmountContract: newUser.totalAmountContract ?? null,
                                    analystPaymentRate: newUser.analystPaymentRate ?? null,
                                    officePaymentRate: newUser.officePaymentRate ?? null,
                                    supervisorId: newUser.supervisorName ? supervisorMap.get(newUser.supervisorName.toLowerCase().trim()) : null,
                                    // @ts-ignore
                                    importBatchId: batch.id
                                }
                            }
                        },
                        include: { student: true }
                    })
                    const s = (user as any).student
                    if (s) studentMap.set(s.fullName.toLowerCase().trim(), s.id)

                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "User",
                            recordId: user.id,
                            action: "CREATE",
                            oldData: {},
                            newData: { id: user.id, email: finalEmail } as any
                        }
                    })
                }

                // Fill map with all existing students
                const currentStuds = await tx.student.findMany()
                currentStuds.forEach(s => studentMap.set(s.fullName.toLowerCase().trim(), s.id))

                // 4. Paso C: Financial Periods (match student by ID or Name)
                for (const conflict of (conflicts ?? [])) {
                    const resolution = resolutions?.[conflict.id]
                    if (resolution === "ignore" || !resolution) continue

                    const oldPeriod = await tx.financialPeriod.findUnique({ where: { id: conflict.periodId } })
                    if (!oldPeriod) continue

                    const newAmount = resolution === "sum"
                        ? Number(oldPeriod.amountDueOffice) + Number(conflict.excelAmount)
                        : Number(conflict.excelAmount)

                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "FinancialPeriod",
                            recordId: conflict.periodId,
                            action: "UPDATE",
                            oldData: oldPeriod as any,
                            newData: { ...oldPeriod, amountDueOffice: newAmount } as any
                        }
                    })

                    await tx.financialPeriod.update({
                        where: { id: conflict.periodId },
                        data: { amountDueOffice: newAmount, importBatchId: batch.id }
                    })
                }

                for (const fp of (newFinancialPeriods ?? [])) {
                    const studentId = fp.studentId || studentMap.get(fp.studentName?.toLowerCase().trim())
                    if (!studentId) continue

                    const created = await (tx as any).financialPeriod.upsert({
                        where: { studentId_periodNumber: { studentId, periodNumber: fp.periodNumber } },
                        update: {},
                        create: {
                            studentId: studentId,
                            periodNumber: fp.periodNumber,
                            monthYearLabel: fp.monthYearLabel,
                            amountDueOffice: fp.amountDueOffice,
                            amountDueAnalyst: fp.amountDueAnalyst,
                            accumulatedDueOffice: fp.accumulatedDueOffice,
                            accumulatedPaidOffice: fp.accumulatedPaidOffice,
                            accumulatedPaidAnalyst: fp.accumulatedPaidAnalyst,
                            importBatchId: batch.id
                        }
                    })

                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "FinancialPeriod",
                            recordId: created.id,
                            action: "CREATE",
                            oldData: {},
                            newData: created as any
                        }
                    })
                }
            }, {
                maxWait: 20000,
                timeout: 180000
            })

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
