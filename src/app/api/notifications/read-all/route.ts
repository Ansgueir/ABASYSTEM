import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function POST() {
    try {
        const session = await auth()
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        await (prisma as any).notification.updateMany({
            where: {
                userId: (session.user as any).id,
                isRead: false
            },
            data: { isRead: true }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error marking all notifications as read:", error)
        return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 })
    }
}
