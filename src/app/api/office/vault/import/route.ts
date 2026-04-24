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

function safeDate(val: any): Date {
    if (!val) return new Date()
    const d = new Date(val)
    if (isNaN(d.getTime())) return new Date()
    const year = d.getUTCFullYear()
    if (year < 1980 || year > 2100) return new Date()
    return d
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
    for (let r = 1; r <= 50; r++) {
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
    const v = val?.toUpperCase().trim() || ""
    if (v.includes("BCABA")) return "BCaBA"
    if (v.includes("BCBA_D") || v.includes("BCBA-D")) return "BCBA_D"
    if (v.includes("BCBA")) return "BCBA"
    if (v.includes("NOT_WORKING") || v.includes("NOT WORKING")) return "RBT_NOT_WORKING"
    if (v.includes("RBT")) return "RBT"
    if (v.includes("LMHC")) return "LMHC"
    if (v.includes("NO CREDENTIAL") || v === "") return "NO_CREDENTIAL"
    return "NO_CREDENTIAL" // Safe fallback instead of crashing
}

function normalizeLevelType(val: string): string {
    const v = val?.toUpperCase().trim() || ""
    if (v.includes("BCABA")) return "BCaBA"
    return "BCBA"
}

function normalizeSupervisionType(val: string): string {
    const v = val?.toUpperCase().trim() || ""
    if (v.includes("CONCENTRATED") || v.includes("CONCENTRADA")) return "CONCENTRATED"
    return "REGULAR"
}

function normalizeFieldworkType(val: string): string {
    const v = val?.toUpperCase().trim() || ""
    if (v.includes("CONCENTRATED") || v.includes("CONCENTRADA")) return "CONCENTRATED"
    return "REGULAR"
}

function normalizeStudentStatus(val: string): any {
    const v = val.toUpperCase().trim()
    if (v === "ACTIVE" || v === "ACTIVO" || v === "ON") return "ACTIVE"
    if (v === "INACTIVE" || v === "INACTIVO" || v === "OFF" || v === "DISABLED") return "DISABLED"
    if (v === "PENDING" || v === "PENDIENTE") return "PENDING"
    if (v === "COMPLETED" || v === "COMPLETO" || v === "TERMINADO") return "COMPLETED"
    if (v === "WITHDRAWN" || v === "RETIRED" || v === "RETIRADO") return "WITHDRAWN"
    return "ACTIVE"
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

            console.log(`[STAGING] Analyzing workbook with ${workbook.worksheets.length} sheets`)
            workbook.eachSheet((sheet) => {
                const name = sheet.name.toUpperCase().trim()
                // Priority 1: Exact matches or very specific keywords
                if (name === "STUDENT" || name === "STUDENTS" || name === "SUPERVISADOS") {
                    sheetStudents = sheet
                } else if (!sheetStudents && (name.includes("STUDENT") || name.includes("SUPERVISADO")) && !name.includes("PAYMENT") && !name.includes("GROUP") && !name.includes("CONTRACT")) {
                    sheetStudents = sheet
                }

                if (name === "SUPERVISOR" || name === "SUPERVISORS" || name === "PARAMETROS") {
                    sheetSupervisors = sheet
                } else if (!sheetSupervisors && (name.includes("SUPERVISOR") || name.includes("PARAMETRO")) && !name.includes("PAYMENT") && !name.includes("LEDGER") && !name.includes("CONTRACT")) {
                    sheetSupervisors = sheet
                }
                
                if (name.includes("OFFICE") && !name.includes("GROUP")) sheetOffices = sheet
                if (name.includes("FINANCIAL") || name.includes("COBROS") || name.includes("TESORERIA")) sheetFinancial = sheet
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
            console.log(`[STAGING] Main sheets: Students=${sheetStudents?.name}, Supervisors=${sheetSupervisors?.name}`)

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
            console.log(`[STAGING] Supervisor Mapping:`, JSON.stringify(spm))
            for (let i = spHeaderIdx + 1; i <= sheetSupervisors.rowCount; i++) {
                const row = sheetSupervisors.getRow(i)
                const name = cellStr(row, spm.fullname || spm.nombrecompleto || spm.name || spm.nombre || spm.supervisor || spm.staff || spm.supervisorname || spm.staffname || 2)
                if (!name || name.length < 3) continue
                
                let email = (spEmailCol ? cellStr(row, spEmailCol) : cellStr(row, spm.email || spm.correo || spm.correoelectronico || 3)).toLowerCase().trim()
                
                // Aggressive: If no real email, generate one so they show up
                if (!email || !email.includes("@")) {
                    email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}_${i}@abasystem.tmp`
                }
                
                const password = cellStr(row, spm.password || 4) || "Aba12345*"
                
                const isDuplicateInBatch = claimedEmailsInBatch.has(email)
                const isAlreadyInDb = existingEmails.has(email)

                if (isDuplicateInBatch || isAlreadyInDb) {
                    headlessUsers.push({ 
                        name, 
                        email, 
                        rowNumber: i, 
                        sourceSheet: "SUPERVISORS", 
                        collisionType: isAlreadyInDb ? "EMAIL_IN_DB" : "DUPLICATE_IN_EXCEL" 
                    })
                }

                // Always include in analysis for visibility
                claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "SUPERVISORS" })
                newSupervisors.push({ 
                    fullName: name, email, password, rowNumber: i, 
                    isExisting: !!existingSupervisors.find((s: any) => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase()),
                    credentialType: normalizeCredentialType(cellStr(row, spm.credentialtype || 6) || "BCBA"),
                        phone: cellStr(row, spm.phone || 9) || "000-000-0000",
                        address: cellStr(row, spm.address || 10) || "N/A",
                        bacbId: cellStr(row, spm.bacbid || 5) || "N/A",
                        certificantNumber: cellStr(row, spm.certificantnumber || 6) || "N/A",
                        originalId: cellStr(row, spm.id || 1)
                })
            }

            const { mapping: stm, headerRowIndex: stHeaderIdx, emailCol: stEmailCol } = mapHeaders(sheetStudents)
            console.log(`[STAGING] Student Mapping:`, JSON.stringify(stm))
            for (let i = stHeaderIdx + 1; i <= sheetStudents.rowCount; i++) {
                const row = sheetStudents.getRow(i)
                const name = cellStr(row, stm.fullname || stm.name || stm.nombre || stm.nombrecompleto || stm.estudiante || stm.practicante || stm.trainee || stm.studentname || stm.student || 2)
                if (!name) continue
                const email = (stEmailCol ? cellStr(row, stEmailCol) : cellStr(row, stm.email || stm.correo || stm.correoelectronico || 3)).toLowerCase().trim()
                
                const password = cellStr(row, stm.password || 4) || "Aba12345*"
                
                const isDuplicateInBatch = claimedEmailsInBatch.has(email)
                const isAlreadyInDb = existingEmails.has(email)

                if (isDuplicateInBatch || isAlreadyInDb) {
                    headlessUsers.push({ 
                        name, 
                        email, 
                        rowNumber: i, 
                        sourceSheet: "STUDENTS", 
                        collisionType: isAlreadyInDb ? "EMAIL_IN_DB" : "DUPLICATE_IN_EXCEL" 
                    })
                }

                // Always include in analysis to give the user visibility
                claimedEmailsInBatch.set(email, { rowNumber: i, sheetName: "STUDENTS" })
                newUsers.push({ 
                    fullName: name, email, password, rowNumber: i, 
                    sourceSheet: "STUDENTS",
                    originalId: cellStr(row, stm.id || 1),
                    isExisting: !!existingStudents.find((s: any) => (email && s.user.email === email) || s.fullName.toLowerCase() === name.toLowerCase()),
                    fields: {
                            supervisorName: cellStr(row, stm.supervisorname || stm.supervisor || stm.supervisorid || stm.nombresupervisor || 11),
                            phone: cellStr(row, stm.phone || stm.telefono || stm.celular || 9),
                            startDate: cellDate(row, stm.startdate || stm.fechainicio || 15),
                            endDate: cellDate(row, stm.enddate || stm.fechafin || 25),
                            status: normalizeStudentStatus(cellStr(row, stm.status || stm.estado || 26) || "ACTIVE"),
                            hoursTargetReg: cellNum(row, stm.hourstargetreg || stm.reghours || stm.horasdirectas || 0),
                            hoursTargetConc: cellNum(row, stm.hourstargetconc || stm.conchours || stm.horasindirectas || 0),
                            independentHoursTarget: cellNum(row, stm.independenthourstarget || 0),
                            totalAmountContract: cellNum(row, stm.totalamountcontract || stm.totalcharge || stm.montototal || 0),
                            analystPaymentRate: cellNum(row, stm.analystpaymentrate || 0),
                            officePaymentRate: cellNum(row, stm.officepaymentrate || 0),
                            bacbId: cellStr(row, stm.bacbid || 5),
                            credential: cellStr(row, stm.credential || 6),
                            school: cellStr(row, stm.school || 7),
                            level: cellStr(row, stm.level || 8),
                            city: cellStr(row, stm.city || 13),
                            state: cellStr(row, stm.state || 14),
                            supervisionType: cellStr(row, stm.supervisiontype || 16),
                            fieldworkType: cellStr(row, stm.fieldworktype || 17),
                            supervisionPercentage: cellNum(row, stm.supervisionpercentage || 18),
                            academicDegree: cellStr(row, stm.academicdegree || 31),
                            planTemplateId: cellStr(row, stm.plantemplateid || 35),
                            assignedOptionPlan: cellStr(row, stm.assignedoptionplan || 34)
                        }
                    })
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

            let existingSupCount = 0
            let existingStudCount = 0
            
            // Optimization: We already have existingSupervisors and existingStudents from earlier
            existingSupCount = existingSupervisors.length
            existingStudCount = existingStudents.length

            return NextResponse.json({
                summary: {
                    newStudents: newUsers.length,
                    existingStudents: existingStudCount,
                    newSupervisors: newSupervisors.length,
                    existingSupervisors: existingSupCount,
                    newContracts: newContracts.length,
                    newHours: newHours.length,
                    newGroups: newGroups.length,
                    newSessions: newSessions.length,
                    financialRecords: newRawPayments.length,
                    conflicts: headlessUsers.length,
                    totalProcessed: newUsers.length + newSupervisors.length + newRawPayments.length + existingStudCount + existingSupCount
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
            const { 
                newUsers = [], 
                newSupervisors = [], 
                newContracts = [], 
                newHours = [], 
                newGroups = [], 
                newSessions = [], 
                newPayments = [], // Matches frontend payload 'newPayments'
                newRawPayments = [] // Legacy support
            } = body
            const batchString = `MASS_LOAD_${format(new Date(), 'yyyyMMdd_HHmm')}`

            console.log(`[IMPORT] Starting bulk commit for batch ${batchString}`)
            console.time("bulk_import_total")

            // PRE-CALCULATE DATA (IDs and Hashes) WITH CONCURRENCY LIMIT (Avoid CPU saturation)
            console.time("hashing_phase")
            const BATCH_SIZE = 50
            const allToHash = [
                ...newSupervisors.map((s: any) => ({ type: 'supervisor', original: s })),
                ...newUsers.map((u: any) => ({ type: 'student', original: u }))
            ]
            
            const hashedResults: any[] = []
            for (let i = 0; i < allToHash.length; i += BATCH_SIZE) {
                const chunk = allToHash.slice(i, i + BATCH_SIZE)
                const processedChunk = await Promise.all(chunk.map(async (item) => {
                    const hash = await bcrypt.hash(item.original.password, 10)
                    return { ...item.original, userId: crypto.randomUUID(), passwordHash: hash, _type: item.type }
                }))
                hashedResults.push(...processedChunk)
            }
            
            const prepSupervisors = hashedResults.filter(r => r._type === 'supervisor' && !r.isExisting)
            const prepStudents = hashedResults.filter(r => r._type === 'student' && !r.isExisting)
            console.timeEnd("hashing_phase")

            // Deduplicate emails in the batch itself to avoid Unique constraint failure within createMany
            const seenEmails = new Set<string>()
            const uniqueSupervisors = prepSupervisors.filter(u => {
                if (seenEmails.has(u.email)) return false
                seenEmails.add(u.email)
                return true
            })
            
            const uniqueStudents = prepStudents.filter(u => {
                if (seenEmails.has(u.email)) return false
                seenEmails.add(u.email)
                return true
            })

            const result = await prisma.$transaction(async (tx) => {
                const batch = await (tx as any).importBatch.create({ data: { batchString, status: "COMPLETED" } })
                const supMap = new Map<string, string>()
                const studMap = new Map<string, string>()

                // 1. BULK USER CREATION (BULLETPROOF DEDUPLICATION)
                console.time("db_users_phase")
                
                const existingUserRecords = await tx.user.findMany({ select: { email: true, id: true } })
                const existingEmailMap = new Map<string, string>()
                existingUserRecords.forEach((u: any) => existingEmailMap.set(u.email.toLowerCase().trim(), u.id))

                const usersToCreate: any[] = []

                uniqueSupervisors.forEach(s => {
                    const cleanEmail = s.email.toLowerCase().trim()
                    if (existingEmailMap.has(cleanEmail)) {
                        s.userId = existingEmailMap.get(cleanEmail)! // Recycle existing ID
                    } else {
                        usersToCreate.push({ id: s.userId, email: cleanEmail, passwordHash: s.passwordHash, role: "SUPERVISOR", isActive: true })
                        existingEmailMap.set(cleanEmail, s.userId) // Prevent duplicates within this loop
                    }
                })

                uniqueStudents.forEach(u => {
                    const cleanEmail = u.email.toLowerCase().trim()
                    if (existingEmailMap.has(cleanEmail)) {
                        u.userId = existingEmailMap.get(cleanEmail)! // Recycle existing ID
                    } else {
                        usersToCreate.push({ id: u.userId, email: cleanEmail, passwordHash: u.passwordHash, role: "STUDENT", isActive: true })
                        existingEmailMap.set(cleanEmail, u.userId) // Prevent duplicates within this loop
                    }
                })

                if (usersToCreate.length > 0) {
                    await tx.user.createMany({ data: usersToCreate, skipDuplicates: true })
                }
                console.timeEnd("db_users_phase")

                // 2. BULK SUPERVISOR CREATION
                console.time("db_supervisors_phase")
                const supervisorsToCreate = uniqueSupervisors.map(s => ({
                    userId: s.userId, fullName: s.fullName, email: s.email, credentialType: s.credentialType, importBatchId: batch.id,
                    phone: s.phone || "000-000-0000", address: s.address || "N/A", 
                    bacbId: s.bacbId || "N/A", 
                    certificantNumber: s.certificantNumber || "N/A",
                    internalIdNumber: s.originalId // Store original Excel ID for mapping
                } as any))
                if (supervisorsToCreate.length > 0) await tx.supervisor.createMany({ data: supervisorsToCreate })

                const allSups = await tx.supervisor.findMany()
                allSups.forEach(s => {
                    const clean = s.fullName.toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ')
                    supMap.set(clean, s.id)
                    if (s.internalIdNumber) supMap.set(s.internalIdNumber, s.id)
                })
                console.timeEnd("db_supervisors_phase")

                // 3. BULK STUDENT CREATION
                console.time("db_students_phase")
                const studentsToCreate = uniqueStudents.map(nu => {
                    const cleanSupName = nu.fields.supervisorName?.toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ')
                    let supervisorId = cleanSupName ? (supMap.get(cleanSupName) || null) : null
                    
                    // Try reverse match for supervisor assignment
                    if (!supervisorId && cleanSupName && cleanSupName.includes(' ')) {
                        const parts = cleanSupName.split(' ')
                        if (parts.length >= 2) {
                            const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`
                            supervisorId = supMap.get(reversed) || null
                        }
                    }

                    return {
                        userId: nu.userId, fullName: nu.fullName, email: nu.email, 
                        startDate: safeDate(nu.fields.startDate), endDate: safeDate(nu.fields.endDate),
                        status: normalizeStudentStatus(nu.fields.status || "ACTIVE"),
                        supervisorId,
                        importBatchId: batch.id, phone: nu.fields.phone || "000-000-0000",
                        bacbId: nu.fields.bacbId || "N/A", 
                        credential: normalizeCredentialType(nu.fields.credential || ""), 
                        school: nu.fields.school || "N/A", 
                        level: normalizeLevelType(nu.fields.level || ""), 
                        city: nu.fields.city || "N/A", 
                        state: nu.fields.state || "N/A",
                        supervisionType: normalizeSupervisionType(nu.fields.supervisionType || ""), 
                        fieldworkType: normalizeFieldworkType(nu.fields.fieldworkType || ""), 
                        supervisionPercentage: nu.fields.supervisionPercentage || 0.05,
                        hoursToDo: nu.fields.hoursTargetReg || 1500, hoursToPay: 0,
                        amountToPay: nu.fields.totalAmountContract || 0, hourlyRate: 0, hoursPerMonth: 130, totalMonths: 12,
                        paymentAlias: nu.originalId ? [nu.originalId] : [],
                        academicDegree: nu.fields.academicDegree,
                        planTemplateId: nu.fields.planTemplateId,
                        assignedOptionPlan: nu.fields.assignedOptionPlan
                    } as any
                })
                if (studentsToCreate.length > 0) await tx.student.createMany({ data: studentsToCreate })

                const allStuds = await tx.student.findMany()
                allStuds.forEach(s => {
                    const clean = s.fullName.toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ')
                    studMap.set(clean, s.id)
                    if (s.paymentAlias && s.paymentAlias.length > 0) {
                        studMap.set(s.paymentAlias[0], s.id)
                    }
                })
                
                // CREATE OFFICIAL ASSIGNMENTS IN StudentSupervisor TABLE
                const studentSupervisorsToCreate = allStuds
                    .filter(s => s.supervisorId)
                    .map(s => ({
                        studentId: s.id,
                        supervisorId: s.supervisorId as string,
                        isPrimary: true
                    }))
                if (studentSupervisorsToCreate.length > 0) {
                    await tx.studentSupervisor.createMany({ data: studentSupervisorsToCreate, skipDuplicates: true })
                }
                
                console.timeEnd("db_students_phase")

                // 4. BULK FINANCIAL RECORDS
                console.time("db_finance_phase")
                const invoicesToCreate: any[] = []
                const paymentsToCreate: any[] = []
                const ledgerToCreate: any[] = []

                // Merge both potential keys to be safe
                const combinedPayments = [...(newPayments || []), ...(newRawPayments || [])]
                console.log(`[IMPORT] Processing ${combinedPayments.length} financial records. Combined keys: newPayments=${(newPayments || []).length}, newRawPayments=${(newRawPayments || []).length}`)

                // DIAGNOSTIC: Print sample of map keys
                const sampleKeys = Array.from(studMap.keys()).slice(0, 10)
                console.log(`[IMPORT] Sample Student Map Keys (Normalized): ${JSON.stringify(sampleKeys)}`)

                let linkedCount = 0
                let orphanedCount = 0
                const orphanedSamples: string[] = []

                for (const rp of combinedPayments) {
                    const rawName = cellStrFromObj(rp.studentName || rp.studentname || rp.studentid || rp.alumno)
                    if (!rawName) continue

                    const cleanName = rawName.toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ')
                    
                    // Try direct match
                    let sid = studMap.get(cleanName)
                    
                    // Try reversed match (if it contains a space)
                    if (!sid && cleanName.includes(' ')) {
                        const parts = cleanName.split(' ')
                        if (parts.length >= 2) {
                            // Try: "Part2, Part1" or "Part2 Part1"
                            const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`
                            sid = studMap.get(reversed)
                        }
                    }

                    if (!sid) {
                        orphanedCount++
                        if (orphanedSamples.length < 10) orphanedSamples.push(rawName)
                        continue
                    }
                    
                    linkedCount++

                    if (rp.type === "INVOICE" && sid) {
                        invoicesToCreate.push({
                            id: rp.id || undefined, studentId: sid, invoiceDate: safeDate(rp.invoiceDate || rp.invoicedate), 
                            amountDue: Number(rp.amountDueOffice || rp.amountdue || 0), amountPaid: Number(rp.amountpaid || 0), 
                            status: rp.status || "PAID", importBatchId: batch.id
                        })
                    } else if (rp.type === "STUDENT_PAYMENT" && sid) {
                        paymentsToCreate.push({
                            studentId: sid, amount: Number(rp.amount || 0), 
                            paymentDate: safeDate(rp.paymentDate || rp.paymentdate || rp.date), 
                            paymentType: rp.paymentType || rp.paymenttype || "ZELLE", importBatchId: batch.id
                        })
                    } else if (rp.type === "SUPERVISOR_PAYMENT") {
                        const supName = cellStrFromObj(rp.supervisorName || rp.supervisorname || rp.supervisorid)
                        const cleanSupName = supName?.toLowerCase().trim().replace(/,/g, '').replace(/\s+/g, ' ')
                        let supId = cleanSupName ? supMap.get(cleanSupName) : null
                        
                        // Try reverse match for supervisor payment
                        if (!supId && cleanSupName && cleanSupName.includes(' ')) {
                            const parts = cleanSupName.split(' ')
                            if (parts.length >= 2) {
                                const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`
                                supId = supMap.get(reversed) || null
                            }
                        }

                        if (supId && sid) {
                            // The frontend reads 'SupervisorLedgerEntry' which requires an Invoice.
                            // We create a technical invoice to satisfy the database schema and UI logic.
                            const technicalInvoice = await tx.invoice.create({
                                data: {
                                    studentId: sid,
                                    invoiceDate: safeDate(rp.paymentDate || rp.paymentdate || rp.date),
                                    amountDue: Number(rp.amount || 0),
                                    amountPaid: Number(rp.amount || 0),
                                    status: "PAID",
                                    importBatchId: batch.id
                                }
                            })

                            await tx.supervisorLedgerEntry.create({
                                data: {
                                    invoiceId: technicalInvoice.id,
                                    supervisorId: supId,
                                    studentId: sid,
                                    paymentFromStudent: Number(rp.amount || 0),
                                    supervisorPayout: Number(rp.amount || 0),
                                    officePayout: 0,
                                    payoutStatus: "PAID",
                                    supervisorCapTotal: 0,
                                    supervisorCapRemainingBefore: 0,
                                    supervisorCapRemainingAfter: 0,
                                    paymentMethod: rp.paymentType || rp.paymenttype || "SYSTEM_IMPORT",
                                    paidAt: safeDate(rp.paymentDate || rp.paymentdate || rp.date),
                                    importBatchId: batch.id
                                }
                            })
                        }
                    } else if (rp.type === "LEDGER_ENTRY" && sid) {
                        const supName = cellStrFromObj(rp.supervisorName || rp.supervisorname || rp.supervisorid)
                        const cleanSupName = supName?.toLowerCase().trim().replace(/\s+/g, ' ')
                        const supId = cleanSupName ? supMap.get(cleanSupName) : null
                        
                        if (supId) {
                            ledgerToCreate.push({
                                invoiceId: "00000000-0000-0000-0000-000000000000", supervisorId: supId, studentId: sid,
                                paymentFromStudent: Number(rp.paymentfromstudent || rp.amount || 0), supervisorPayout: Number(rp.supervisorpayout || 0),
                                officePayout: Number(rp.officepayout || 0), payoutStatus: rp.payoutstatus || "PAID",
                                importBatchId: batch.id, supervisorCapTotal: 0, supervisorCapRemainingBefore: 0, supervisorCapRemainingAfter: 0
                            })
                        }
                    }
                }

                console.log(`[IMPORT] Finance mapping results: Linked=${linkedCount}, Orphaned=${orphanedCount}`)
                if (orphanedSamples.length > 0) console.log(`[IMPORT] Sample orphaned names: ${JSON.stringify(orphanedSamples)}`)
                if (invoicesToCreate.length > 0) await tx.invoice.createMany({ data: invoicesToCreate })
                if (paymentsToCreate.length > 0) await tx.studentPayment.createMany({ data: paymentsToCreate })
                if (ledgerToCreate.length > 0) await tx.supervisorLedgerEntry.createMany({ data: ledgerToCreate })
                console.timeEnd("db_finance_phase")
            }, { timeout: 600000 })
            console.timeEnd("bulk_import_total")
            return NextResponse.json({ success: true })
        }
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error("[IMPORT ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
