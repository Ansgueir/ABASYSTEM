/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        // §7 Security gateway
        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { batchId } = await request.json()
        if (!batchId) return new NextResponse("Missing batchId", { status: 400 })

        const batch = await (prisma as any).importBatch.findUnique({
            where: { id: batchId },
            include: { logs: true }
        })

        if (!batch || batch.revertedAt) {
            return new NextResponse("Batch not found or already reverted", { status: 400 })
        }

        await prisma.$transaction(async (tx) => {
            // §7 DUAL DELETION POLICY
            const createLogs = batch.logs.filter((l: any) => l.action === "CREATE")
            const updateLogs = batch.logs.filter((l: any) => l.action === "UPDATE")

            // ── §7 HARD DELETE ──
            const fpIdsToDelete = createLogs.filter((l: any) => l.tableName === "FinancialPeriod").map((l: any) => l.recordId)
            const userIdsToDelete = createLogs.filter((l: any) => l.tableName === "User").map((l: any) => l.recordId)

            // 1. Borrar FinancialPeriods creados
            if (fpIdsToDelete.length > 0) {
                await tx.financialPeriod.deleteMany({
                    where: { id: { in: fpIdsToDelete } }
                })
            }

            // 2. Borrar Students y Users creados
            // Importante: Borrar Student antes que User para evitar conflictos de FK si el cascade no está activo
            if (userIdsToDelete.length > 0) {
                await tx.student.deleteMany({
                    where: { userId: { in: userIdsToDelete } }
                })
                await tx.user.deleteMany({
                    where: { id: { in: userIdsToDelete } }
                })
            }

            // ── §7 REVERT (UPDATE) ──
            for (const log of updateLogs) {
                const oldData: any = log.oldData
                if (!oldData) continue

                if (log.tableName === "FinancialPeriod") {
                    await tx.financialPeriod.update({
                        where: { id: log.recordId },
                        data: {
                            amountDueOffice:        oldData.amountDueOffice,
                            amountDueAnalyst:       oldData.amountDueAnalyst,
                            accumulatedDueOffice:   oldData.accumulatedDueOffice,
                            accumulatedPaidOffice:  oldData.accumulatedPaidOffice,
                            accumulatedPaidAnalyst: oldData.accumulatedPaidAnalyst,
                            importBatchId:          null
                        }
                    }).catch(() => console.log(`Rollback: Record ${log.recordId} in ${log.tableName} missing, skipping.`))
                } else if (log.tableName === "Student") {
                    await tx.student.update({
                        where: { id: log.recordId },
                        data: {
                            phone:                  oldData.phone,
                            vcsSequence:            oldData.vcsSequence,
                            totalMonths:            oldData.totalMonths,
                            regularHoursTarget:     oldData.regularHoursTarget,
                            concentratedHoursTarget: oldData.concentratedHoursTarget,
                            independentHoursTarget: oldData.independentHoursTarget,
                            totalAmountContract:    oldData.totalAmountContract,
                            endDate:                oldData.endDate ? new Date(oldData.endDate) : undefined,
                            importBatchId:          null
                        }
                    }).catch(() => {})
                } else if (log.tableName === "Supervisor") {
                    await tx.supervisor.update({
                        where: { id: log.recordId },
                        data: {
                            certificantNumber: oldData.certificantNumber,
                            dateQualified:     oldData.dateQualified ? new Date(oldData.dateQualified) : undefined,
                            examDate:          oldData.examDate ? new Date(oldData.examDate) : undefined,
                            importBatchId:     null
                        }
                    }).catch(() => {})
                }
            }

            // Finalizar transacción marcando el lote como revertido
            await (tx as any).importBatch.update({
                where: { id: batchId },
                data: { revertedAt: new Date(), status: "REVERTED" }
            })
        }, {
            maxWait: 20000,
            timeout: 90000
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("[UNDO ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
