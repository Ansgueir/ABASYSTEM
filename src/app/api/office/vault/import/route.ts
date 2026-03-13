import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import bcrypt from "bcryptjs"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        // 1. RESTRICCIÓN DE ACCESO (SECURITY GATEWAY)
        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const contentType = request.headers.get("content-type") || ""

        if (contentType.includes("multipart/form-data")) {
            // ==========================================
            // STAGING PHASE (Form Data with Excel File)
            // ==========================================
            const formData = await request.formData()
            const file = formData.get("file") as File
            if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(await file.arrayBuffer() as any)

            const studentAliases = ['supervisados', 'students']
            const financialAliases = ['base datos', 'cobros', 'financial history (48 periods)']

            let sheetStudents: ExcelJS.Worksheet | undefined
            let sheetFinancial: ExcelJS.Worksheet | undefined

            workbook.eachSheet((sheet) => {
                const sheetName = sheet.name.toLowerCase().trim()
                if (studentAliases.includes(sheetName)) {
                    sheetStudents = sheet
                } else if (financialAliases.includes(sheetName)) {
                    sheetFinancial = sheet
                }
            })

            if (!sheetStudents || !sheetFinancial) {
                return NextResponse.json({ error: "Error: No se encontró la pestaña de datos. Asegúrese de que el archivo contenga una hoja llamada 'Supervisados' o 'Students'" }, { status: 400 })
            }

            const existingStudents = await prisma.student.findMany({
                include: { user: true, financialPeriods: true, supervisor: true }
            })
            const existingSupervisors = await prisma.supervisor.findMany({
                include: { user: true }
            })

            let skippedRowsCount = 0
            const newUsers: any[] = []
            const conflicts: any[] = []
            const validData: any = { studentsToUpdate: [], financialPeriodsToUpdate: [] }

            // Parse Students
            const studentLatestRows = new Map<string, any>()

            sheetStudents.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return // header
                
                const traineeName = String(row.getCell("B").value || "").toLowerCase().trim()
                const bacbId = String(row.getCell("D").value || "").trim()
                
                if (!traineeName) return

                const startDateCell = row.getCell("L").value // 'Start Date' is L or 12th assuming match
                const startDateStr = startDateCell ? new Date(startDateCell as string | Date) : new Date(0)

                const identityKey = `${bacbId}_${traineeName}`

                const existingData = studentLatestRows.get(identityKey)
                if (!existingData || startDateStr > existingData.startDateStr) {
                    studentLatestRows.set(identityKey, {
                        rowNumber,
                        row,
                        startDateStr,
                        traineeName,
                        bacbId
                    })
                }
            })

            // Process unique students with their latest rows
            for (const [key, data] of studentLatestRows.entries()) {
                const { row, startDateStr, traineeName, bacbId, rowNumber } = data

                const existingStudent = existingStudents.find(
                    s => s.bacbId === bacbId && s.fullName.toLowerCase().trim() === traineeName
                )

                if (!existingStudent) {
                    // New user candidate
                    newUsers.push({
                        role: "STUDENT",
                        fullName: String(row.getCell("B").value || ""),
                        bacbId,
                        email: String(row.getCell("I").value || "").trim().toLowerCase() || `student${rowNumber}@pending.com`,
                        phone: String(row.getCell("H").value || ""),
                        startDate: startDateStr.getTime() === 0 ? null : startDateStr
                    })
                } else {
                    // Incremental Sync
                    // Si una celda viene vacía, no sobrescribir la DB
                    const updates: any = {}
                    const newPhone = String(row.getCell("H").value || "")
                    if (newPhone && !existingStudent.phone) updates.phone = newPhone
                    
                    if (Object.keys(updates).length > 0) {
                        validData.studentsToUpdate.push({ id: existingStudent.id, ...updates })
                    }
                }
            }

            // Parse Financial History
            sheetFinancial.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return
                const studentName = String(row.getCell("A").value || "").toLowerCase().trim()
                const periodNum = Number(row.getCell("C").value || 0)
                const excelDueOffice = Number(row.getCell("E").value || 0)

                const existingStudent = existingStudents.find(
                    s => s.fullName.toLowerCase().trim() === studentName
                )

                if (existingStudent) {
                    const existingPeriod = existingStudent.financialPeriods.find(p => p.periodNumber === periodNum)
                    
                    if (existingPeriod) {
                        const dbDueOffice = Number(existingPeriod.amountDueOffice || 0)
                        
                        // Financial Conflict Detection
                        if (dbDueOffice !== excelDueOffice) {
                            conflicts.push({
                                id: `CFL-${existingPeriod.id}`,
                                periodId: existingPeriod.id,
                                studentName: existingStudent.fullName,
                                type: "Student",
                                periodNumber: periodNum,
                                month: existingPeriod.monthYearLabel,
                                dbAmount: dbDueOffice,
                                excelAmount: excelDueOffice,
                                field: "amountDueOffice"
                            })
                        }
                    } else {
                        // Period missing in DB but exists in Excel? Create it. (Skipping for brevity in this MVP, 
                        // as we only need to show conflicts for existing things based on DoD)
                    }
                }
            })

            return NextResponse.json({
                skippedRowsCount,
                newUsers,
                conflicts,
                validData
            })

        } else if (contentType.includes("application/json")) {
            // ==========================================
            // COMMIT PHASE (Atomic Execution)
            // ==========================================
            const body = await request.json()
            const { data, newUsers, resolutions, conflicts } = body

            const batchString = `IMP_${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}`

            // 5. EJECUCIÓN ATÓMICA (COMMIT)
            await prisma.$transaction(async (tx) => {
                // 1. Create ImportBatch
                // @ts-ignore
                const batch = await (tx as any).importBatch.create({
                    data: {
                        batchString,
                        status: "COMPLETED"
                    }
                })

                // 2. Resolve conflicts & Update
                for (const conflict of conflicts) {
                    const resolution = resolutions[conflict.id]
                    if (resolution === "ignore" || !resolution) continue

                    // Get old data for ImportLog
                    const oldPeriod = await tx.financialPeriod.findUnique({ where: { id: conflict.periodId } })
                    if (!oldPeriod) continue

                    let newAmount = 0
                    if (resolution === "sum") {
                        newAmount = Number(oldPeriod.amountDueOffice) + Number(conflict.excelAmount)
                    } else if (resolution === "replace") {
                        newAmount = Number(conflict.excelAmount)
                    }

                    // @ts-ignore
                    await (tx as any).importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "FinancialPeriod",
                            recordId: conflict.periodId,
                            oldData: oldPeriod as any,
                            newData: { ...oldPeriod, amountDueOffice: newAmount } as any
                        }
                    })

                    // @ts-ignore
                    await (tx as any).financialPeriod.update({
                        where: { id: conflict.periodId },
                        data: { amountDueOffice: newAmount, importBatchId: batch.id }
                    })
                }

                // 3. Create new users
                for (const newUser of newUsers) {
                    const hash = await bcrypt.hash("Aba12345*", 10)
                    const user = await tx.user.create({
                        data: {
                            email: newUser.email,
                            passwordHash: hash,
                            role: "STUDENT",
                            isActive: true,
                            requiresWizard: true, // Flag Onboarding
                            isFirstLogin: true,
                            onboardingCompleted: false,
                            student: {
                                create: {
                                    fullName: newUser.fullName,
                                    bacbId: newUser.bacbId,
                                    phone: newUser.phone,
                                    email: newUser.email,
                                    startDate: new Date(newUser.startDate || new Date()),
                                    credential: "NO_CREDENTIAL", // placeholders
                                    level: "BCBA", // placeholder
                                    school: "Unknown",
                                    city: "Unknown",
                                    state: "FL",
                                    supervisionType: "REGULAR",
                                    supervisionPercentage: 0,
                                    hoursToDo: 0,
                                    hoursToPay: 0,
                                    amountToPay: 0,
                                    hoursPerMonth: 0,
                                    totalMonths: 0,
                                    endDate: new Date(),
                                    // @ts-ignore
                                    importBatchId: batch.id
                                }
                            }
                        }
                    })

                    // @ts-ignore
                    await tx.importLog.create({
                        data: {
                            batchId: batch.id,
                            tableName: "User",
                            recordId: user.id,
                            oldData: {},
                            newData: { id: user.id } as any
                        }
                    })
                }
            })

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
