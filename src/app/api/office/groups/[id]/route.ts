import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

async function guardSuperAdmin() {
    const session = await auth()
    const role = String((session?.user as any)?.role || "").toLowerCase()
    const officeRole = String((session?.user as any)?.officeRole || "").toUpperCase()
    if (role !== "qa" && officeRole !== "SUPER_ADMIN") return null
    return session
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await context.params
    const body = await req.json()
    const { name, startTime, endTime } = body

    const group = await (prisma as any).officeGroup.update({
        where: { id },
        data: {
            ...(name && { name: name.trim() }),
            ...(startTime && { startTime }),
            ...(endTime && { endTime }),
        }
    })
    return NextResponse.json({ success: true, group })
}

export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await context.params
    await (prisma as any).officeGroup.delete({ where: { id } })
    return NextResponse.json({ success: true })
}
