import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

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
            // Restore from logs
            for (const log of batch.logs) {
                if (log.tableName === "FinancialPeriod") {
                    const oldData: any = log.oldData
                    if (oldData) {
                        try {
                            await tx.financialPeriod.update({
                                where: { id: log.recordId },
                                data: { amountDueOffice: oldData.amountDueOffice }
                            })
                        } catch (e) {
                            // record might have been deleted, ignore
                        }
                    }
                } else if (log.tableName === "User") {
                    // Soft-delete user newly created
                    try {
                        await tx.user.update({
                            where: { id: log.recordId },
                            data: { isHidden: true, isActive: false }
                        })
                    } catch (e) {
                        // ignore if missing
                    }
                }
            }

            await (tx as any).importBatch.update({
                where: { id: batchId },
                data: { revertedAt: new Date(), status: "REVERTED" }
            })
        })

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
