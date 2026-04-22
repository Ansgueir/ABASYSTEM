import { prisma } from "@/lib/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function validatePlanLimits(
    studentId: string, 
    date: Date, 
    newHours: number, 
    hourType: 'independent' | 'supervision', 
    excludeLogId?: string, 
    format?: 'INDIVIDUAL' | 'GROUP'
) {
    console.log(`[Plan-Validation-Debug] validatePlanLimits started for student ${studentId} (${hourType}${format ? `:${format}` : ''})`)
    const student = await prisma.student.findUnique({
        where: { id: studentId }
    })

    if (!student) throw new Error("Student not found")

    let plan = null;
    if (student.planTemplateId) {
        plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
    }

    // 1. Get targets (Default fallback to old standards if no plan)
    const maxHoursPerMonth = student.hoursPerMonth || plan?.hoursPerMonth || 130
    const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
    
    // Supervised percentage logic
    let supervisedPercentage = 0.05
    if (student.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisedPercentage = sp > 1 ? sp / 100 : sp
    } else if (plan?.supervisedPercentage) {
        supervisedPercentage = Number(plan.supervisedPercentage)
    }

    console.log(`[Plan-Validation-Debug] Student: ${student.fullName}, Monthly Limit: ${maxHoursPerMonth}, Lifetime Limit: ${totalPlanHours}, Supervised%: ${supervisedPercentage}`)

    const maxSupervisedHoursTotal = Number(plan?.amountSupHours) || (totalPlanHours * supervisedPercentage)
    
    // Subdivision targets
    const maxSupIndividual = plan?.individualSupervisedTarget ? Number(plan.individualSupervisedTarget) : null
    const maxSupGroup = plan?.groupSupervisionTarget ? Number(plan.groupSupervisionTarget) : null

    let maxIndependentHours = 0
    if (student.independentHoursTarget && student.independentHoursTarget > 0) {
        maxIndependentHours = student.independentHoursTarget
    } else {
        maxIndependentHours = totalPlanHours - maxSupervisedHoursTotal
    }

    // --- MONTHLY LIMIT CHECK ---
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    const indepCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }
    const supCondition: any = { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }

    if (excludeLogId) {
        indepCondition.id = { not: excludeLogId }
        supCondition.id = { not: excludeLogId }
    }

    const monthlyIndep = await prisma.independentHour.aggregate({ where: indepCondition, _sum: { hours: true } })
    const monthlySup = await prisma.supervisionHour.aggregate({ where: supCondition, _sum: { hours: true } })

    const monthGroupAtt = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId, attended: true, session: { date: { gte: start, lte: end } } },
        include: { session: true }
    })
    const syncedMonthGroupIds = new Set(
        (await prisma.supervisionHour.findMany({
            where: { studentId, supervisionType: 'GROUP', date: { gte: start, lte: end }, groupSessionId: { not: null } },
            select: { groupSessionId: true }
        })).map(h => h.groupSessionId)
    )
    const monthExtraGroupHours = monthGroupAtt.filter(a => !syncedMonthGroupIds.has(a.sessionId)).length

    const currentMonthly = (Number(monthlyIndep._sum.hours) || 0) + (Number(monthlySup._sum.hours) || 0) + monthExtraGroupHours
    
    console.log(`[Plan-Validation-Debug] Month: ${start.toISOString()} to ${end.toISOString()}, Current: ${currentMonthly}, New: ${newHours}, Max: ${maxHoursPerMonth}`)

    if (currentMonthly + newHours > maxHoursPerMonth) {
        throw new Error(`Monthly Limit Exceeded: The plan for ${student.fullName} allows a maximum of ${maxHoursPerMonth}h per month. You tried to add ${(currentMonthly + newHours).toFixed(2)}h. Only ${(maxHoursPerMonth - currentMonthly).toFixed(2)}h are available for this month.`)
    }

    // --- LIFETIME LIMIT CHECK ---
    const indepLifetimeCondition: any = { studentId, status: { not: 'REJECTED' } }
    const supIndivLifetimeCondition: any = { studentId, supervisionType: 'INDIVIDUAL', status: { not: 'REJECTED' } }
    const supGroupLifetimeCondition: any = { studentId, supervisionType: 'GROUP', status: { not: 'REJECTED' } }

    if (excludeLogId) {
        indepLifetimeCondition.id = { not: excludeLogId }
        supIndivLifetimeCondition.id = { not: excludeLogId }
        supGroupLifetimeCondition.id = { not: excludeLogId }
    }

    const lifetimeIndep = await prisma.independentHour.aggregate({ where: indepLifetimeCondition, _sum: { hours: true } })
    const lifetimeSupIndiv = await prisma.supervisionHour.aggregate({ where: supIndivLifetimeCondition, _sum: { hours: true } })
    const lifetimeSupGroup = await prisma.supervisionHour.aggregate({ where: supGroupLifetimeCondition, _sum: { hours: true } })
    
    const groupAttLifetime = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId, attended: true },
        include: { session: true }
    })

    const syncedGroupSessionIds = new Set(
        (await prisma.supervisionHour.findMany({
            where: { studentId, supervisionType: 'GROUP', groupSessionId: { not: null } },
            select: { groupSessionId: true }
        })).map(h => h.groupSessionId)
    )

    const extraGroupHours = groupAttLifetime
        .filter(a => !syncedGroupSessionIds.has(a.sessionId))
        .length 

    const totalIndep = Number(lifetimeIndep._sum.hours) || 0
    const totalSupIndiv = (Number(lifetimeSupIndiv._sum.hours) || 0)
    const totalSupGroup = (Number(lifetimeSupGroup._sum.hours) || 0) + extraGroupHours 
    const totalSupTotal = totalSupIndiv + totalSupGroup
    
    console.log(`[Plan-Validation-Debug] Lifetime Totals: Indep=${totalIndep}, SupIndiv=${totalSupIndiv}, SupGroup=${totalSupGroup} (+Fallback)`)

    if (totalIndep + totalSupTotal + newHours > totalPlanHours) {
        throw new Error(`Master Plan Limit: ${student.fullName} already has ${(totalIndep + totalSupTotal).toFixed(2)}h of the ${totalPlanHours}h total allowed. The current entry of ${newHours.toFixed(2)}h exceeds the plan's total cap.`);
    }

    if (hourType === 'independent') {
        if (totalIndep + newHours > maxIndependentHours) {
            throw new Error(`Independent Hours Limit: The plan allows a maximum of ${maxIndependentHours.toFixed(1)}h independent hours. Total accumulated: ${totalIndep.toFixed(2)}h. Available: ${(maxIndependentHours - totalIndep).toFixed(2)}h.`)
        }
    } else {
        // Supervision check
        if (totalSupTotal + newHours > maxSupervisedHoursTotal) {
            throw new Error(`Supervised Hours Limit (Total): The plan allows total of ${maxSupervisedHoursTotal.toFixed(1)}h supervised hours. Total accumulated: ${totalSupTotal.toFixed(2)}h. Available: ${(maxSupervisedHoursTotal - totalSupTotal).toFixed(2)}h.`)
        }

        // Subdivision checks
        if (format === 'GROUP' && maxSupGroup !== null) {
            if (totalSupGroup + newHours > maxSupGroup) {
                throw new Error(`Group Supervision Limit: The plan restricts group supervision to ${maxSupGroup.toFixed(1)}h. Total accumulated: ${totalSupGroup.toFixed(1)}h. Available: ${(maxSupGroup - totalSupGroup).toFixed(2)}h.`)
            }
        } else if (format === 'INDIVIDUAL' && maxSupIndividual !== null) {
            if (totalSupIndiv + newHours > maxSupIndividual) {
                throw new Error(`Individual Supervised Limit: The plan restricts individual supervised hours to ${maxSupIndividual.toFixed(1)}h. Total accumulated: ${totalSupIndiv.toFixed(1)}h. Available: ${(maxSupIndividual - totalSupIndiv).toFixed(2)}h.`)
            }
        }
    }
}

export async function validatePlanLimitsBulk(
    studentId: string, 
    logs: { date: Date, hours: number, type: 'independent' | 'supervision' }[],
    options: { allowAutoTrim?: boolean } = {}
) {
    console.log(`[Plan-Validation-Debug] validatePlanLimitsBulk started for student ${studentId} with ${logs.length} entries`)
    if (logs.length === 0) return

    const student = await prisma.student.findUnique({ where: { id: studentId } })
    if (!student) throw new Error("Student not found")

    let plan = null;
    if (student.planTemplateId) {
        plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
    }

    const maxHoursPerMonth = student.hoursPerMonth || plan?.hoursPerMonth || 130
    const totalPlanHours = student.hoursToDo || plan?.totalHours || 2000
    
    let supervisedPercentage = 0.05
    if (student.supervisionPercentage) {
        const sp = Number(student.supervisionPercentage)
        supervisedPercentage = sp > 1 ? sp / 100 : sp
    } else if (plan?.supervisedPercentage) {
        supervisedPercentage = Number(plan.supervisedPercentage)
    }

    const maxSupervisedHours = Number(plan?.amountSupHours) || (totalPlanHours * supervisedPercentage)
    const maxIndependentHours = (student.independentHoursTarget && student.independentHoursTarget > 0) 
        ? student.independentHoursTarget 
        : totalPlanHours - maxSupervisedHours

    const totalNewHours = logs.reduce((sum, l) => sum + l.hours, 0)
    const totalNewIndep = logs.filter(l => l.type === 'independent').reduce((sum, l) => sum + l.hours, 0)
    const totalNewSup = logs.filter(l => l.type === 'supervision').reduce((sum, l) => sum + l.hours, 0)

    const lifetimeIndep = await prisma.independentHour.aggregate({ where: { studentId, status: { not: 'REJECTED' } }, _sum: { hours: true } })
    const lifetimeSup = await prisma.supervisionHour.aggregate({ where: { studentId, status: { not: 'REJECTED' } }, _sum: { hours: true } })

    const groupAttLifetime = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId, attended: true }
    })
    const syncedGroupSessionIds = new Set(
        (await prisma.supervisionHour.findMany({
            where: { studentId, supervisionType: 'GROUP', groupSessionId: { not: null } },
            select: { groupSessionId: true }
        })).map(h => h.groupSessionId)
    )
    const extraGroupHours = groupAttLifetime.filter(a => !syncedGroupSessionIds.has(a.sessionId)).length

    const totalIndep = Number(lifetimeIndep._sum.hours) || 0
    const totalSup = (Number(lifetimeSup._sum.hours) || 0) + extraGroupHours

    if (totalIndep + totalSup + totalNewHours > totalPlanHours + 0.0001) {
        if (!options.allowAutoTrim) {
            throw new Error(`Bulk Operation Rejected: This massive load of ${totalNewHours.toFixed(2)}h would exceed the total plan limit (${totalPlanHours}h). You currently have ${(totalIndep + totalSup).toFixed(2)}h.`);
        }
        // If auto-trim is allowed, we let it pass as long as it's within a reasonable "trimming" range
        // (e.g. if the excess is less than one full session or a reasonable buffer)
    }

    if (totalNewIndep > 0 && totalIndep + totalNewIndep > maxIndependentHours + 0.0001) {
        if (!options.allowAutoTrim) {
            throw new Error(`Bulk Operation Rejected: The load of ${totalNewIndep.toFixed(2)}h independent hours exceeds the allowed limit for this modality (${maxIndependentHours.toFixed(1)}h).`);
        }
    }

    if (totalNewSup > 0 && totalSup + totalNewSup > maxSupervisedHours + 0.0001) {
        if (!options.allowAutoTrim) {
            throw new Error(`Bulk Operation Rejected: The load of ${totalNewSup.toFixed(2)}h supervised hours exceeds the allowed limit (${maxSupervisedHours.toFixed(1)}h).`);
        }
    }

    const monthsAffected = new Map<string, { year: number, month: number, hours: number }>()
    for (const log of logs) {
        const key = `${log.date.getFullYear()}-${log.date.getMonth()}`
        const existing = monthsAffected.get(key) || { year: log.date.getFullYear(), month: log.date.getMonth(), hours: 0 }
        existing.hours += log.hours
        monthsAffected.set(key, existing)
    }

    for (const [_, info] of monthsAffected) {
        const start = startOfMonth(new Date(info.year, info.month, 15))
        const end = endOfMonth(start)

        const mIndep = await prisma.independentHour.aggregate({ where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }, _sum: { hours: true } })
        const mSup = await prisma.supervisionHour.aggregate({ where: { studentId, date: { gte: start, lte: end }, status: { not: 'REJECTED' } }, _sum: { hours: true } })

        const monthGroupAtt = await prisma.groupSupervisionAttendance.findMany({
            where: { studentId, attended: true, session: { date: { gte: start, lte: end } } },
            include: { session: true }
        })
        const syncedMonthGroupIds = new Set(
            (await prisma.supervisionHour.findMany({
                where: { studentId, supervisionType: 'GROUP', date: { gte: start, lte: end }, groupSessionId: { not: null } },
                select: { groupSessionId: true }
            })).map(h => h.groupSessionId)
        )
        const monthExtraGroupHours = monthGroupAtt.filter(a => !syncedMonthGroupIds.has(a.sessionId)).length

        const currentMonthly = (Number(mIndep._sum.hours) || 0) + (Number(mSup._sum.hours) || 0) + monthExtraGroupHours
        
        console.log(`[Plan-Validation-Debug] BULK Month ${info.month+1}/${info.year}: Current=${currentMonthly} (DB=${(Number(mIndep._sum.hours)||0)+(Number(mSup._sum.hours)||0)}, fallbackGroup=${monthExtraGroupHours}), New=${info.hours}, Max=${maxHoursPerMonth}`)

        if (currentMonthly + info.hours > maxHoursPerMonth + 0.0001) {
            if (!options.allowAutoTrim) {
                throw new Error(`Bulk Monthly Limit: For the month ${info.month + 1}/${info.year}, your massive entry of ${info.hours.toFixed(2)}h exceeds the monthly cap of ${maxHoursPerMonth}h.`);
            }
            // With allowAutoTrim, we let it pass; the actual logging logic will handle the trimming
            console.log(`[Plan-Validation-Debug] BULK Month ${info.month+1}/${info.year} excess allowed due to allowAutoTrim`)
        }
    }
    console.log(`[Plan-Validation-Debug] validatePlanLimitsBulk passed for student ${studentId}`)
}
