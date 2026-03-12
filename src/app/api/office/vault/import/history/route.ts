import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) return new NextResponse("Unauthorized", { status: 401 })

        if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const batches = await (prisma as any).importBatch.findMany({
            orderBy: { createdAt: "desc" },
            include: { logs: { select: { id: true } } }
        })

        return NextResponse.json(batches)
    } catch (e: any) {
        console.error(e)
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 })
    }
}
