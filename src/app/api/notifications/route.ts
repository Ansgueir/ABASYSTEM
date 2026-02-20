import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
    try {
        const session = await auth()
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const notifications = await (prisma as any).notification.findMany({
            where: { userId: (session.user as any).id },
            orderBy: { createdAt: "desc" },
            take: 20
        })

        return NextResponse.json(notifications)
    } catch (error) {
        console.error("Error fetching notifications:", error)
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
    }
}
