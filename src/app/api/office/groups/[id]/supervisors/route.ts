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

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await context.params
    const { supervisorId } = await req.json()
    if (!supervisorId) return NextResponse.json({ error: "supervisorId required" }, { status: 400 })

    try {
        const entry = await (prisma as any).officeGroupSupervisor.create({
            data: { groupId: id, supervisorId }
        })
        return NextResponse.json({ success: true, entry })
    } catch (e: any) {
        if (e.code === "P2002") return NextResponse.json({ error: "Already assigned" }, { status: 409 })
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const { id } = await context.params
    const { supervisorId } = await req.json()
    if (!supervisorId) return NextResponse.json({ error: "supervisorId required" }, { status: 400 })

    await (prisma as any).officeGroupSupervisor.deleteMany({
        where: { groupId: id, supervisorId }
    })
    return NextResponse.json({ success: true })
}
