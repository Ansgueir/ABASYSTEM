import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

const ALLOWED_TYPES = ["REGULAR", "CONCENTRATED"]
const ALLOWED_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

async function guardSuperAdmin() {
    const session = await auth()
    const role = String((session?.user as any)?.role || "").toLowerCase()
    const officeRole = String((session?.user as any)?.officeRole || "").toUpperCase()
    if (role !== "qa" && officeRole !== "SUPER_ADMIN") return null
    return session
}

export async function GET() {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const groups = await (prisma as any).officeGroup.findMany({
        orderBy: [{ groupType: "asc" }, { dayOfWeek: "asc" }],
        include: {
            supervisors: {
                include: {
                    supervisor: { select: { id: true, fullName: true, email: true, credentialType: true, status: true } }
                }
            }
        }
    })

    // Also return all active supervisors so the UI can show unassigned ones
    const allSupervisors = await prisma.supervisor.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, email: true, credentialType: true },
        orderBy: { fullName: "asc" }
    })

    return NextResponse.json({ success: true, groups, allSupervisors })
}

export async function POST(req: NextRequest) {
    if (!await guardSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const { name, groupType, dayOfWeek, startTime, endTime } = body

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 })
    if (!ALLOWED_TYPES.includes(groupType)) return NextResponse.json({ error: "Invalid group type" }, { status: 400 })
    if (!ALLOWED_DAYS.includes(dayOfWeek)) return NextResponse.json({ error: "Invalid day" }, { status: 400 })
    if (!startTime || !endTime) return NextResponse.json({ error: "Start and end time are required" }, { status: 400 })

    // Enforce max 1 REGULAR + 1 CONCENTRATED per day via DB unique constraint
    try {
        const group = await (prisma as any).officeGroup.create({
            data: { name: name.trim(), groupType, dayOfWeek, startTime, endTime }
        })
        return NextResponse.json({ success: true, group })
    } catch (e: any) {
        if (e.code === "P2002") {
            return NextResponse.json({ error: `A ${groupType} group already exists for ${dayOfWeek}` }, { status: 409 })
        }
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
