import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })
        
        // Security check
        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const { batchId } = await request.json()
        if (!batchId) return NextResponse.json({ error: "No batch ID provided" }, { status: 400 })

        const batch = await (prisma as any).importBatch.findUnique({
            where: { id: batchId }
        })

        if (!batch) return NextResponse.json({ error: "Batch not found" }, { status: 404 })
        if (batch.status === "REVERTED") return NextResponse.json({ error: "Batch already reverted" }, { status: 400 })

        await prisma.$transaction(async (tx) => {
            // 1. Find users to delete (linked via Student or Supervisor to this batch)
            const studentsToDel = await tx.student.findMany({ where: { importBatchId: batchId }, select: { id: true, userId: true } })
            const supervisorsToDel = await tx.supervisor.findMany({ where: { importBatchId: batchId }, select: { id: true, userId: true } })
            
            const userIds = [
                ...studentsToDel.map(s => s.userId),
                ...supervisorsToDel.map(s => s.userId)
            ]

            // 2. Delete dependent transactional records
            await (tx as any).financialPeriod.deleteMany({ where: { importBatchId: batchId } })
            await (tx as any).studentPayment.deleteMany({ where: { importBatchId: batchId } })
            await (tx as any).supervisorPayment.deleteMany({ where: { importBatchId: batchId } })
            await (tx as any).supervisorLedgerEntry.deleteMany({ where: { importBatchId: batchId } })
            await (tx as any).invoice.deleteMany({ where: { importBatchId: batchId } })
            
            // 3. Clear assignments for students in this batch
            const sIds = studentsToDel.map(s => s.id)
            if (sIds.length > 0) {
                await (tx as any).studentSupervisor.deleteMany({ where: { studentId: { in: sIds } } })
            }

            // 4. Delete Student/Supervisor profiles (Only those created in this batch)
            await tx.student.deleteMany({ where: { importBatchId: batchId } })
            await tx.supervisor.deleteMany({ where: { importBatchId: batchId } })

            // 5. Delete the Users themselves
            if (userIds.length > 0) {
                await tx.user.deleteMany({ where: { id: { in: userIds } } })
            }

            // 6. Update batch status
            await (tx as any).importBatch.update({
                where: { id: batchId },
                data: { status: "REVERTED", revertedAt: new Date() }
            })

            // 6. Log the rollback action
            await (tx as any).auditLog.create({
                data: {
                    userId: (session.user as any).id,
                    action: "IMPORT_ROLLBACK",
                    entity: "ImportBatch",
                    entityId: batchId,
                    details: `Rollback performed for batch ${batch.batchString}`
                }
            })
        }, { timeout: 300000 })

        return NextResponse.json({ success: true, message: `Batch ${batch.batchString} reverted successfully.` })

    } catch (error: any) {
        console.error("[ROLLBACK ERROR]", error)
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
    }
}
