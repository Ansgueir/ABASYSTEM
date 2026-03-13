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
    return String(row.getCell(col).value || "").trim()
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

            // §2 Multi-sheet aliases
            const studentAliases    = ["supervisados", "students"]
            const supervisorAliases = ["supervisors", "parametros", "supervisores"]
            const financialAliases  = ["base datos", "cobros", "financial history (48 periods)"]

            let sheetStudents: ExcelJS.Worksheet | undefined
            let sheetSupervisors: ExcelJS.Worksheet | undefined
            let sheetFinancial: ExcelJS.Worksheet | undefined

            const detectedSheets: string[] = []
            workbook.eachSheet((sheet) => {
                const name = sheet.name.toLowerCase().trim()
                detectedSheets.push(sheet.name)
                if (studentAliases.includes(name))    sheetStudents    = sheet
                else if (supervisorAliases.includes(name)) sheetSupervisors = sheet
                else if (financialAliases.includes(name))  sheetFinancial   = sheet
            })

            console.log("[IMPORT] Detected sheets:", detectedSheets)
            console.log("[IMPORT] Students sheet:", sheetStudents?.name || "NOT FOUND")
            console.log("[IMPORT] Supervisors sheet:", sheetSupervisors?.name || "NOT FOUND")
            console.log("[IMPORT] Financial sheet:", sheetFinancial?.name || "NOT FOUND")

            if (!sheetStudents || !sheetFinancial) {
                return NextResponse.json({
                    error: `Error: No se encontró la pestaña requerida. Hojas detectadas: [${detectedSheets.join(", ")}]. Se necesita una hoja llamada 'Supervisados' o 'Students' y 'Cobros', 'Base Datos' o 'Financial History (48 Periods)'.`
                }, { status: 400 })
            }

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
            const claimedEmailsInBatch = new Set<string>()

            let skippedRowsCount = 0
            const newUsers: any[] = []
            const supervisorUpdates: any[] = []
            const conflicts: any[] = []
            const newFinancialPeriods: any[] = []
            const headlessUsers: string[] = []
            const validData: any = { studentsToUpdate: [], financialPeriodsToUpdate: [] }

            // ── §2 Parse Students sheet (Data Dictionary) ──────────────────
            const studentLatestRows = new Map<string, any>()

            sheetStudents.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return // skip header
                const traineeName = cellStr(row, "B").toLowerCase()
                const bacbId      = cellStr(row, "D")
                if (!traineeName) { skippedRowsCount++; return }

                const startDateStr = cellDate(row, "L") ?? new Date(0)
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

                // §2 Extended field extraction
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
                const credential            = cellStr(row, "E") || null
                const status                = cellStr(row, "U") || null

                if (!existingStudent) {
                    // First-In email policy
                    const rawEmail = cellStr(row, "I").toLowerCase()
                    let assignedEmail: string | null = null
                    if (rawEmail && !existingEmails.has(rawEmail) && !claimedEmailsInBatch.has(rawEmail)) {
                        assignedEmail = rawEmail
                        claimedEmailsInBatch.add(rawEmail)
                    } else {
                        headlessUsers.push(`${cellStr(row, "B")} (row ${rowNumber})`)
                    }

                    newUsers.push({
                        role:                 "STUDENT",
                        fullName:             cellStr(row, "B"),
                        bacbId,
                        email:                assignedEmail,
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
                        status
                    })
                } else {
                    // Fill-Only sync — only write fields that are currently empty in DB
                    const updates: any = {}
                    if (phone          && !existingStudent.phone)          updates.phone          = phone
                    if (vcsSequence    && !existingStudent.vcsSequence)    updates.vcsSequence    = vcsSequence
                    if (totalMonths    && !existingStudent.totalMonths)    updates.totalMonths    = totalMonths
                    if (regHoursTarget && !existingStudent.regularHoursTarget)    updates.regularHoursTarget    = regHoursTarget
                    if (concHoursTarget && !existingStudent.concentratedHoursTarget) updates.concentratedHoursTarget = concHoursTarget
                    if (indHoursTarget && !existingStudent.independentHoursTarget) updates.independentHoursTarget = indHoursTarget
                    if (totalAmountContract && !existingStudent.totalAmountContract) updates.totalAmountContract = totalAmountContract
                    if (endDate && !existingStudent.endDate) updates.endDate = endDate

                    if (Object.keys(updates).length > 0) {
                        validData.studentsToUpdate.push({ id: existingStudent.id, ...updates })
                    }
                }
            }

            // ── §2 Parse Supervisors sheet ──────────────────────────────────
            if (sheetSupervisors) {
                sheetSupervisors.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return
                    const supName  = cellStr(row, "A").toLowerCase()
                    const bacbId   = cellStr(row, "C")
                    const certNum  = cellStr(row, "D") || null
                    const qualLevel = cellStr(row, "E") || null
                    const dateQual = cellDate(row, "F")
                    const examDate = cellDate(row, "G")

                    if (!supName) return

                    const existingSup = existingSupervisors.find(
                        s => s.fullName.toLowerCase().trim() === supName || (bacbId && s.bacbId === bacbId)
                    )

                    if (existingSup) {
                        const updates: any = {}
                        if (certNum  && !existingSup.certificantNumber) updates.certificantNumber = certNum
                        if (dateQual && !existingSup.dateQualified)     updates.dateQualified     = dateQual
                        if (examDate && !existingSup.examDate)          updates.examDate          = examDate

                        if (Object.keys(updates).length > 0) {
                            supervisorUpdates.push({ id: existingSup.id, ...updates })
                        }
                    }
                })
            }

            // ── §2 Parse Financial History sheet ────────────────────────────
            sheetFinancial.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return
                const studentName    = cellStr(row, "A").toLowerCase()
                const periodNum      = cellNum(row, "C")
                const monthLabel     = cellStr(row, "D") || `Period ${periodNum}`
                const excelDueOffice = cellNum(row, "E")
                const excelDueAnalyst = cellNum(row, "I")
                const excelPaidOfficeAcum   = cellNum(row, "H")
                const excelPaidAnalystAcum  = cellNum(row, "L")
                const excelDueOfficeAcum    = cellNum(row, "F")

                if (!studentName || !periodNum) return

                const existingStudent = existingStudents.find(
                    s => s.fullName.toLowerCase().trim() === studentName
                )

                if (!existingStudent) return

                const existingPeriod = existingStudent.financialPeriods.find(p => p.periodNumber === periodNum)

                if (existingPeriod) {
                    const dbDueOffice = Number(existingPeriod.amountDueOffice || 0)
                    if (dbDueOffice !== excelDueOffice) {
                        conflicts.push({
                            id:            `CFL-${existingPeriod.id}`,
                            periodId:      existingPeriod.id,
                            studentName:   existingStudent.fullName,
                            type:          "Student",
                            periodNumber:  periodNum,
                            month:         existingPeriod.monthYearLabel,
                            dbAmount:      dbDueOffice,
                            excelAmount:   excelDueOffice,
                            field:         "amountDueOffice"
                        })
                    }
                } else if (excelDueOffice > 0 || excelDueAnalyst > 0) {
                    // §2 Create missing financial periods
                    newFinancialPeriods.push({
                        studentId:             existingStudent.id,
                        periodNumber:          periodNum,
                        monthYearLabel:        monthLabel,
                        amountDueOffice:       excelDueOffice,
                        amountDueAnalyst:      excelDueAnalyst,
                        accumulatedDueOffice:  excelDueOfficeAcum,
                        accumulatedPaidOffice: excelPaidOfficeAcum,
                        accumulatedPaidAnalyst: excelPaidAnalystAcum
                    })
                }
            })

            return NextResponse.json({
                skippedRowsCount,
                newUsers,
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
            const { newUsers, supervisorUpdates, resolutions, conflicts, newFinancialPeriods, validData } = body

            const batchString = `IMP_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`

            await prisma.$transaction(async (tx) => {
                // 1. Create ImportBatch
                const batch = await (tx as any).importBatch.create({
                    data: { batchString, status: "COMPLETED" }
                })

                // 2. Resolve financial conflicts
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
                            batchId:   batch.id,
                            tableName: "FinancialPeriod",
                            recordId:  conflict.periodId,
                            action:    "UPDATE",
                            oldData:   oldPeriod as any,
                            newData:   { ...oldPeriod, amountDueOffice: newAmount } as any
                        }
                    })

                    await (tx as any).financialPeriod.update({
                        where: { id: conflict.periodId },
                        data:  { amountDueOffice: newAmount, importBatchId: batch.id }
                    })
                }

                // 3. Create new financial periods (missing ones from Excel)
                for (const fp of (newFinancialPeriods ?? [])) {
                    const created = await (tx as any).financialPeriod.upsert({
                        where:  { studentId_periodNumber: { studentId: fp.studentId, periodNumber: fp.periodNumber } },
                        update: {},
                        create: {
                            studentId:              fp.studentId,
                            periodNumber:           fp.periodNumber,
                            monthYearLabel:         fp.monthYearLabel,
                            amountDueOffice:        fp.amountDueOffice,
                            amountDueAnalyst:       fp.amountDueAnalyst,
                            accumulatedDueOffice:   fp.accumulatedDueOffice,
                            accumulatedPaidOffice:  fp.accumulatedPaidOffice,
                            accumulatedPaidAnalyst: fp.accumulatedPaidAnalyst,
                            importBatchId:          batch.id
                        }
                    })

                    await (tx as any).importLog.create({
                        data: {
                            batchId:   batch.id,
                            tableName: "FinancialPeriod",
                            recordId:  created.id,
                            action:    "CREATE",
                            oldData:   {},
                            newData:   created as any
                        }
                    })
                }

                // 4. Update existing students (fill-only)
                for (const update of (validData?.studentsToUpdate ?? [])) {
                    const { id, ...fields } = update
                    await tx.student.update({ where: { id }, data: fields })
                }

                // 5. Update supervisors (fill-only)
                for (const update of (supervisorUpdates ?? [])) {
                    const { id, ...fields } = update
                    await tx.supervisor.update({ where: { id }, data: fields })
                }

                // 6. Create new users
                const usedEmailsInTx = new Set<string>()
                for (const newUser of (newUsers ?? [])) {
                    const hash = await bcrypt.hash("Aba12345*", 10)

                    let finalEmail = newUser.email ? newUser.email.trim().toLowerCase() : null
                    if (!finalEmail || usedEmailsInTx.has(finalEmail)) {
                        const safeName = String(newUser.fullName || "user").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
                        finalEmail = `${safeName}_${Date.now()}_${Math.floor(Math.random() * 9999)}@pending.import`
                    }
                    usedEmailsInTx.add(finalEmail)

                    // Map optionPlan to enum
                    const optionPlanMap: Record<string, string> = { A: "A", B: "B", C: "C", D: "D", E: "E" }
                    const normalizedPlan = newUser.optionPlan ? optionPlanMap[String(newUser.optionPlan).toUpperCase()] ?? null : null

                    // Map credential to enum
                    const credentialMap: Record<string, string> = {
                        "RBT": "RBT", "BCBA": "BCBA", "BCaBA": "BCaBA", "LMHC": "LMHC",
                        "RBT_NOT_WORKING": "RBT_NOT_WORKING", "NO_CREDENTIAL": "NO_CREDENTIAL"
                    }
                    const normalizedCred = newUser.credential ? credentialMap[String(newUser.credential).trim()] ?? "NO_CREDENTIAL" : "NO_CREDENTIAL"

                    // Map level to enum
                    const levelMap: Record<string, string> = { "BCBA": "BCBA", "BCaBA": "BCaBA" }
                    const normalizedLevel = newUser.level ? levelMap[String(newUser.level).trim()] ?? "BCBA" : "BCBA"

                    const user = await tx.user.create({
                        data: {
                            email:              finalEmail,
                            passwordHash:       hash,
                            role:               "STUDENT",
                            isActive:           true,
                            requiresWizard:     true,
                            isFirstLogin:       true,
                            onboardingCompleted: false,
                            student: {
                                create: {
                                    fullName:               newUser.fullName,
                                    bacbId:                 newUser.bacbId ?? "",
                                    phone:                  newUser.phone ?? "",
                                    email:                  finalEmail,
                                    startDate:              new Date(newUser.startDate || new Date()),
                                    endDate:                newUser.endDate ? new Date(newUser.endDate) : new Date(),
                                    credential:             normalizedCred as any,
                                    level:                  normalizedLevel as any,
                                    school:                 "Unknown",
                                    city:                   "Unknown",
                                    state:                  "FL",
                                    supervisionType:        "REGULAR",
                                    supervisionPercentage:  0,
                                    hoursToDo:              0,
                                    hoursToPay:             0,
                                    amountToPay:            0,
                                    hoursPerMonth:          0,
                                    totalMonths:            newUser.totalMonths ?? 0,
                                    vcsSequence:            newUser.vcsSequence ?? null,
                                    assignedOptionPlan:     normalizedPlan as any,
                                    regularHoursTarget:     newUser.regHoursTarget ?? null,
                                    concentratedHoursTarget: newUser.concHoursTarget ?? null,
                                    independentHoursTarget: newUser.indHoursTarget ?? null,
                                    totalAmountContract:    newUser.totalAmountContract ?? null,
                                    // @ts-ignore
                                    importBatchId:          batch.id
                                }
                            }
                        }
                    })

                    await (tx as any).importLog.create({
                        data: {
                            batchId:   batch.id,
                            tableName: "User",
                            recordId:  user.id,
                            action:    "CREATE",
                            oldData:   {},
                            newData:   { id: user.id, email: finalEmail } as any
                        }
                    })
                }
            }, {
                maxWait: 15000,
                timeout: 120000
            })

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
