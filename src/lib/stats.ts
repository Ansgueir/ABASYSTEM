import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function getMonthStats(studentId: string, date: Date = new Date()) {
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const independent = await prisma.independentHour.findMany({
        where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    })

    const supervision = await prisma.supervisionHour.findMany({
        where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    })

    const student = await prisma.student.findUnique({
        where: { id: studentId }
    });

    let plan = null;
    if (student?.planTemplateId) {
        plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
    }

    const limit = student?.hoursPerMonth || plan?.hoursPerMonth || 130;
    let supervisionTargetPct = 5;
    if (student?.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisionTargetPct = sp > 1 ? sp : sp * 100
    } else if (plan?.supervisedPercentage) {
        supervisionTargetPct = Number(plan.supervisedPercentage) * 100
    }

    const totalIndependent = independent.reduce((sum, h) => sum + Number(h.hours), 0)
    
    // FETCH GROUP ATTENDANCE FALLBACK
    const groupAtt = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId, attended: true, session: { date: { gte: start, lte: end } } },
        include: { session: true }
    })
    const syncedGroupSessionIds = new Set(
        supervision
            .filter(h => h.supervisionType === 'GROUP' && h.groupSessionId)
            .map(h => h.groupSessionId)
    )
    const extraGroupHours = groupAtt.filter(a => {
        const hasSyncedId = syncedGroupSessionIds.has(a.sessionId)
        const hasSimilarDate = supervision.some(h => 
            h.supervisionType === 'GROUP' && 
            new Date(h.date).toISOString().split('T')[0] === new Date(a.session.date).toISOString().split('T')[0]
        )
        return !hasSyncedId && !hasSimilarDate
    }).length

    const totalSupervision = supervision.reduce((sum, h) => sum + Number(h.hours || 0), 0) + extraGroupHours
    
    console.log(`[STATS-DEBUG] Student: ${studentId}, Month: ${start.toISOString()}, Indep: ${totalIndependent}, Sup: ${totalSupervision - extraGroupHours}, ExtraGroup: ${extraGroupHours}`)
    const total = totalIndependent + totalSupervision

    const restrictedIndependent = independent
        .filter(h => h.activityType === 'RESTRICTED')
        .reduce((sum, h) => sum + Number(h.hours), 0)

    const restrictedSupervision = supervision
        .filter(h => h.activityType === 'RESTRICTED')
        .reduce((sum, h) => sum + Number(h.hours), 0)

    const totalRestricted = restrictedIndependent + restrictedSupervision
    const restrictedPercentage = total > 0 ? (totalRestricted / total) * 100 : 0

    const supervisionPercentage = total > 0 ? (totalSupervision / total) * 100 : 0

    // --- LIFETIME STATS ---
    const allIndep = await prisma.independentHour.aggregate({
        where: { studentId, status: { not: 'REJECTED' } },
        _sum: { hours: true }
    })
    const allSup = await prisma.supervisionHour.aggregate({
        where: { studentId, status: { not: 'REJECTED' } },
        _sum: { hours: true }
    })
    
    const allGroupAtt = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId, attended: true }
    })
    const allSyncedGroupIds = new Set(
        (await prisma.supervisionHour.findMany({
            where: { studentId, supervisionType: 'GROUP', groupSessionId: { not: null } },
            select: { groupSessionId: true }
        })).map(h => h.groupSessionId)
    )
    const allExtraGroupHours = allGroupAtt.filter(a => {
        const hasSyncedId = allSyncedGroupIds.has(a.sessionId)
        // Since we don't have all supervision dates here (only aggregate), we rely on IDs for lifetime
        // BUT we can at least check if we have ANY hour on that specific session date if we fetch them.
        // For performance, we'll stick to ID first, but the contract fix will ensure future ones have IDs.
        return !hasSyncedId
    }).length

    const lifetimeIndependent = Number(allIndep._sum.hours || 0)
    const lifetimeSupervision = Number(allSup._sum.hours || 0) + allExtraGroupHours
    
    const maxSupervisionTotal = plan?.amountSupHours ? Number(plan.amountSupHours) : (student?.hoursToDo ?? 2000) * (supervisionTargetPct / 100)
    const maxIndependentTotal = (student?.hoursToDo ?? 2000) - maxSupervisionTotal

    return {
        total,
        totalIndependent,
        totalSupervision,
        totalRestricted,
        restrictedPercentage,
        supervisionPercentage,
        supervisionTargetPct,
        limit,
        maxSupervisionMonth: limit * (supervisionTargetPct / 100),
        maxIndependentMonth: limit * (1 - supervisionTargetPct / 100),
        // Lifetime
        lifetimeIndependent,
        lifetimeSupervision,
        maxIndependentTotal,
        maxSupervisionTotal,
        totalLifetime: student?.hoursToDo ?? 2000
    }
}
