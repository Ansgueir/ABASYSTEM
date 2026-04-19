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

    // 1. Fetch current group and its supervisors
    const currentGroup = await (prisma as any).officeGroup.findUnique({
        where: { id },
        include: { supervisors: true }
    })
    
    if (!currentGroup) return NextResponse.json({ error: "Group not found" }, { status: 404 })

    const finalStartTime = startTime || currentGroup.startTime;
    const finalEndTime = endTime || currentGroup.endTime;

    // 2. Validate overlaps for ALL assigned supervisors if time was changed
    if (startTime || endTime) {
        for (const sup of currentGroup.supervisors) {
            const supervisorId = sup.supervisorId;
            const existingAssignments = await (prisma as any).officeGroupSupervisor.findMany({
                where: { supervisorId },
                include: { officeGroup: true }
            })

            const overlap = existingAssignments.find((a: any) => {
                const g = a.officeGroup;
                if (g.id === id) return false;
                if (g.dayOfWeek !== currentGroup.dayOfWeek) return false;

                const timeToMin = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                const ts1 = timeToMin(finalStartTime);
                const te1 = timeToMin(finalEndTime);
                const ts2 = timeToMin(g.startTime);
                const te2 = timeToMin(g.endTime);

                return ts1 < te2 && ts2 < te1;
            })

            if (overlap) {
                return NextResponse.json({ 
                    error: `No puedes modificar el horario a ${finalStartTime}-${finalEndTime}. El supervisor asignado tiene conflicto con el grupo '${overlap.officeGroup.name}' en este mismo día.` 
                }, { status: 400 })
            }
        }
    }

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
