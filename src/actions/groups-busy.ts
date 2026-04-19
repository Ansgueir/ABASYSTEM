"use server"
import { prisma } from "@/lib/prisma"

export async function getBusySupervisorIds(dateStr: string, timeStr: string, excludeSessionId?: string) {
    try {
        const date = new Date(dateStr)
        const [hours, mins] = timeStr.split(':').map(Number)
        
        // Target time to check
        const targetStart = new Date(date)
        targetStart.setHours(hours, mins, 0, 0)
        
        const busyIds = new Set<string>()

        // 1. Check actual sessions overlapping in a 1-hour window
        const actualSessions = await (prisma as any).groupSupervisionSession.findMany({
            where: {
                date: {
                    gte: new Date(targetStart.getTime() - 1000 * 60 * 59),
                    lte: new Date(targetStart.getTime() + 1000 * 60 * 59)
                },
                id: excludeSessionId && !excludeSessionId.startsWith('virtual_') ? { not: excludeSessionId } : undefined
            }
        })

        for (const s of actualSessions) {
            busyIds.add(s.supervisorId)
        }

        // 2. Check virtual/office groups running on this day of week & time
        const dayOfWeekIndex = date.getDay()
        const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"]
        const targetDayName = DAY_NAMES[dayOfWeekIndex]

        const officeGroups = await (prisma as any).officeGroup.findMany({
            where: { dayOfWeek: targetDayName },
            include: { supervisors: true }
        })

        for (const g of officeGroups) {
            const [gH, gM] = String(g.startTime).split(':').map(Number)
            const gStart = new Date(date)
            gStart.setHours(gH, gM, 0, 0)
            
            if (Math.abs(gStart.getTime() - targetStart.getTime()) < 1000 * 60 * 59) {
                // Wait! If the user is editing THIS EXACT group's session, we must exclude the supervisors assigned to this exact group from being "busy" due to THIS group.
                // How do we know which group this is? From excludeSessionId!
                // But wait, if excludeSessionId is a virtual session (or actual), the caller doesn't provide groupId directly to this function.
                // We'll let the frontend ensure the CURRENTly assigned supervisor of the session they are editing is ALWAYS available in the dropdown! Even if they are technically "busy" according to this query.
                for (const sup of g.supervisors) {
                    busyIds.add(sup.supervisorId)
                }
            }
        }

        return { success: true, busyIds: Array.from(busyIds) }
    } catch (error) {
        console.error("Busy Query Error:", error)
        return { success: false, busyIds: [] }
    }
}
