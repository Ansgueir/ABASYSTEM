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
            // Separate logs into CREATE (hard-delete) vs UPDATE (revert to oldData)
            const createLogs = batch.logs.filter((l: any) => l.action === "CREATE")
            const updateLogs = batch.logs.filter((l: any) => l.action === "UPDATE")

            // ── §7 HARD DELETE: obliterate records created by this import ──
            // Process in dependency order: FinancialPeriods first, then Students→Users
            const fpToDelete: string[] = []
            const userToDelete: string[] = []

            for (const log of createLogs) {
                if (log.tableName === "FinancialPeriod") {
                    fpToDelete.push(log.recordId)
                } else if (log.tableName === "User") {
                    userToDelete.push(log.recordId)
                }
            }

            if (fpToDelete.length > 0) {
                await tx.financialPeriod.deleteMany({
                    where: { id: { in: fpToDelete } }
                })
            }

            // Deleting User cascades to Student (onDelete: Cascade via userId relation)
            for (const userId of userToDelete) {
                try {
                    await tx.user.delete({ where: { id: userId } })
                } catch {
                    // Already deleted or constraint — skip silently
                }
            }

            // ── §7 REVERT (OVERWRITE): restore oldData for previously existing records ──
            for (const log of updateLogs) {
                if (log.tableName === "FinancialPeriod") {
                    const oldData: any = log.oldData
                    if (oldData?.id) {
                        try {
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
                            })
                        } catch {
                            // Record might have been altered or deleted, skip
                        }
                    }
                } else if (log.tableName === "Student") {
                    const oldData: any = log.oldData
                    if (oldData?.id) {
                        try {
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
                            })
                        } catch {
                            // skip
                        }
                    }
                } else if (log.tableName === "Supervisor") {
                    const oldData: any = log.oldData
                    if (oldData?.id) {
                        try {
                            await tx.supervisor.update({
                                where: { id: log.recordId },
                                data: {
                                    certificantNumber: oldData.certificantNumber,
                                    dateQualified:     oldData.dateQualified ? new Date(oldData.dateQualified) : undefined,
                                    examDate:          oldData.examDate ? new Date(oldData.examDate) : undefined,
                                    importBatchId:     null
                                }
                            })
                        } catch {
                            // skip
                        }
                    }
                }
            }

            // Mark batch as reverted
            await (tx as any).importBatch.update({
                where: { id: batchId },
                data:  { revertedAt: new Date(), status: "REVERTED" }
            })
        }, {
            maxWait: 10000,
            timeout: 60000
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("[UNDO ERROR]", e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
