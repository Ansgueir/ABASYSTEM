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

            workbook.eachSheet((sheet) => {
                const name = sheet.name.toUpperCase().trim()
                if (name === "STUDENTS" || name === "STUDENT" || name === "SUPERVISADOS") sheetStudents = sheet
                if (name === "SUPERVISORS" || name === "SUPERVISOR" || name === "PARAMETROS") sheetSupervisors = sheet
                if (name === "OFFICES" || name === "OFFICE") sheetOffices = sheet
                if (name === "FINANCIALS" || name === "FINANCIAL" || name === "COBROS") sheetFinancial = sheet
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
            const supervisorUpdates: any[] = []
            const conflicts: any[] = []
            const newFinancialPeriods: any[] = []
            const headlessUsers: any[] = []
            const validData: any = { studentsToUpdate: [] }

            // ── §1 Parse SUPERVISORS ───────────────────────────
            for (let i = 2; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const name = cellStr(row, "B")
                if (!name) continue

                const email = cellStr(row, "C").toLowerCase()
                const password = cellStr(row, "D") || "Aba12345*"
                const bacbId = cellStr(row, "E")
                const qual = cellStr(row, "F")

                const existingSup = existingSupervisors.find(
                    s => s.fullName.toLowerCase().trim() === name.toLowerCase().trim() || (email && s.user.email === email)
                )

                if (existingSup) {
                    supervisorUpdates.push({ 
                        id: existingSup.id, 
                        bacbId, 
                        credentialType: normalizeCredentialType(qual || "BCBA"), 
                        rowNumber: i, 
                        sourceSheet: "SUPERVISORS" 
                    })
                } else if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                    claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "SUPERVISORS" })
                    newSupervisors.push({ 
                        fullName: name, 
                        email, 
                        password, 
                        bacbId, 
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

                const existingStud = existingStudents.find((s: any) => s.bacbId === bacbId || (email && s.user.email === email))
                
                const fields = {
                    credential:             normalizeCredentialType(cellStr(row, "F")),
                    phone:                 cellStr(row, "H"),
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
                    officePaymentRate:     cellNum(row, "U") || null
                }

                if (!existingStud) {
                    if (email && !existingEmails.has(email) && !claimedEmailsInBatch.has(email)) {
                        claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "STUDENTS" })
                        newUsers.push({ fullName: name, email, password, supervisorName, fields, rowNumber: i, sourceSheet: "STUDENTS" })
                    } else {
                        headlessUsers.push({ name, email: email || "(vacio)", rowNumber: i, sourceSheet: "STUDENTS", collisionType: "EMAIL_DUPLICATE" })
                    }
                } else {
                    validData.studentsToUpdate.push({ id: existingStud.id, supervisorName, ...fields, rowNumber: i, sourceSheet: "STUDENTS" })
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

            return NextResponse.json({
                studentsStats: { new: newUsers.length, updated: validData.studentsToUpdate.length },
                supervisorsStats: { new: newSupervisors.length, updated: supervisorUpdates.length },
                financialStats: { clean: newFinancialPeriods.length, conflicts: conflicts.length },
                newUsers, newSupervisors, newOffices, supervisorUpdates, conflicts, newFinancialPeriods, validData, headlessUsers, ignoredRows: []
            })

        // ══════════════════════════════════════════
        // COMMIT PHASE
        // ══════════════════════════════════════════
        } else if (contentType.includes("application/json")) {
            const body = await request.json()
            const { newUsers, newSupervisors, newOffices, supervisorUpdates, resolutions, conflicts, newFinancialPeriods, validData } = body
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
                            supervisor: { create: { fullName: sup.fullName, email: sup.email, bacbId: sup.bacbId || "N/A", credentialType: sup.credentialType, importBatchId: batch.id } }
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
            }, { timeout: 180000 })
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
