import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const session = await auth()
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        await (prisma as any).notification.update({
            where: { id },
            data: { isRead: true }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error marking notification as read:", error)
        return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 })
    }
}
