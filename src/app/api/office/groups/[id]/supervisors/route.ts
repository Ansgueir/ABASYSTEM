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
    try {
        const { supervisorId } = await req.json()
        if (!supervisorId) return NextResponse.json({ error: "supervisorId required" }, { status: 400 })

        const entry = await (prisma as any).officeGroupSupervisor.create({
            data: { groupId: id, supervisorId }
        })

        // Fetch office group to generate sessions
        const group = await (prisma as any).officeGroup.findUnique({ where: { id } })
        if (group) {
            const [startHour, startMin] = String(group.startTime).split(":").map(Number)

            const dayIndices: Record<string, number> = {
                SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
                THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
            }
            const targetDay = dayIndices[group.dayOfWeek] ?? 1
            const now = new Date()
            now.setHours(0, 0, 0, 0)
            const diff = (targetDay - now.getDay() + 7) % 7
            let current = new Date(now)
            current.setDate(current.getDate() + diff)

            // Generate 52 weeks
            const sessionsData = []
            for (let i = 0; i < 52; i++) {
                const sessionDate = new Date(current)
                const startTimeD = new Date(current)
                startTimeD.setHours(startHour, startMin, 0, 0)

                sessionsData.push({
                    supervisorId,
                    date: sessionDate,
                    startTime: startTimeD,
                    topic: `${group.groupType} Group — ${group.dayOfWeek} ${group.startTime}–${group.endTime}`,
                    maxStudents: 10
                })
                current.setDate(current.getDate() + 7)
            }

            await (prisma as any).groupSupervisionSession.createMany({
                data: sessionsData,
                skipDuplicates: true
            })
        }

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
