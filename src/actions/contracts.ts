"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { sendEmail } from "@/lib/email"

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAY_INDICES: Record<string, number> = {
    SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
    THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
}

function generateGroupDates(startDate: Date, endDate: Date, dayOfWeek: string, intervalDays: number): Date[] {
    const targetDay = DAY_INDICES[dayOfWeek] ?? 1
    const dates: Date[] = []
    const current = new Date(startDate)
    current.setHours(0, 0, 0, 0)
    // Advance to first occurrence of targetDay
    const diff = (targetDay - current.getDay() + 7) % 7
    current.setDate(current.getDate() + diff)
    while (current <= endDate) {
        dates.push(new Date(current))
        current.setDate(current.getDate() + intervalDays)
    }
    return dates
}

async function scheduleGroupSessions(
    studentId: string,
    groupAssignments: Array<{ supervisorId: string; officeGroupId: string }>,
    startDate: Date,
    endDate: Date,
    planType: string
) {
    const n = groupAssignments.length
    if (n === 0) return

    // ── Fetch Plan Target ─────────────────────────────────────────────────────
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { planTemplateId: true }
    })
    
    let maxGroupHours = 26 // default fallback
    if (student?.planTemplateId) {
        const plan = await prisma.plan.findUnique({ where: { id: student.planTemplateId } })
        if (plan?.groupSupervisionTarget) {
            maxGroupHours = Number(plan.groupSupervisionTarget)
        }
    }

    let currentScheduledHours = 0

    // ── Interval/offset matrix ────────────────────────────────────────────────
    let intervalDays: number
    let offsetMultiplierDays: number
    if (planType === "CONCENTRATED") {
        if (n === 1) { intervalDays = 7; offsetMultiplierDays = 0 }
        else if (n === 2) { intervalDays = 14; offsetMultiplierDays = 7 }
        else { intervalDays = 28; offsetMultiplierDays = 7 }
    } else { // REGULAR
        if (n === 1) { intervalDays = 14; offsetMultiplierDays = 0 }
        else { intervalDays = 28; offsetMultiplierDays = 14 }
    }

    const withGroups = await Promise.all(
        groupAssignments.map(async (ga, idx) => {
            const officeGroup = await (prisma as any).officeGroup.findUnique({ where: { id: ga.officeGroupId } })
            return { ga, officeGroup, idx }
        })
    )
    const sorted = withGroups
        .filter(x => x.officeGroup)
        .sort((a, b) => (DAY_INDICES[a.officeGroup.dayOfWeek] ?? 0) - (DAY_INDICES[b.officeGroup.dayOfWeek] ?? 0))

    for (let i = 0; i < sorted.length; i++) {
        const { ga, officeGroup } = sorted[i]
        const [startHour, startMin] = String(officeGroup.startTime).split(":").map(Number)
        const [endHour, endMin] = String(officeGroup.endTime).split(":").map(Number)

        const effectiveStart = new Date(startDate)
        effectiveStart.setDate(effectiveStart.getDate() + i * offsetMultiplierDays)
        effectiveStart.setHours(0, 0, 0, 0)

        const dates = generateGroupDates(effectiveStart, endDate, officeGroup.dayOfWeek, intervalDays)

        for (const date of dates) {
            // STOP if we reached the plan's target
            if (currentScheduledHours >= maxGroupHours - 0.0001) break

            const sessionDate = new Date(date)
            sessionDate.setHours(0, 0, 0, 0)
            const startTime = new Date(date)
            startTime.setHours(startHour, startMin, 0, 0)
            const endTime = new Date(date)
            endTime.setHours(endHour, endMin, 0, 0)
            const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
            const hoursToAdd = durationHours > 0 ? durationHours : 1

            const dayStart = new Date(sessionDate); dayStart.setHours(0, 0, 0, 0)
            const dayEnd = new Date(sessionDate); dayEnd.setHours(23, 59, 59, 999)

            let existingSession = await (prisma as any).groupSupervisionSession.findFirst({
                where: { groupId: ga.officeGroupId, supervisorId: ga.supervisorId, date: { gte: dayStart, lte: dayEnd } }
            })

            let sessionId: string
            if (existingSession) {
                sessionId = existingSession.id
            } else {
                const created = await (prisma as any).groupSupervisionSession.create({
                    data: {
                        groupId: ga.officeGroupId,
                        supervisorId: ga.supervisorId,
                        date: sessionDate,
                        startTime,
                        topic: `${officeGroup.groupType} Group — ${officeGroup.dayOfWeek} ${officeGroup.startTime}–${officeGroup.endTime}`,
                        maxStudents: 10
                    }
                })
                sessionId = created.id
                existingSession = created
            }

            if (sessionDate.getTime() >= startDate.getTime()) {
                const existingAttendance = await (prisma as any).groupSupervisionAttendance.findFirst({
                    where: { sessionId, studentId }
                })
                if (!existingAttendance) {
                    await (prisma as any).groupSupervisionAttendance.create({
                        data: { sessionId, studentId, attended: true }
                    })
                }

                // DE-DUPLICATION: Check if there is ANY group hour for this student on this day
                const existingHour = await (prisma as any).supervisionHour.findFirst({
                    where: { 
                        studentId, 
                        date: sessionDate, 
                        supervisionType: "GROUP"
                    }
                })

                if (!existingHour) {
                    await (prisma as any).supervisionHour.create({
                        data: {
                            studentId,
                            supervisorId: ga.supervisorId,
                            date: sessionDate,
                            startTime,
                            hours: hoursToAdd,
                            supervisionType: "GROUP",
                            setting: "OFFICE_CLINIC",
                            activityType: "RESTRICTED",
                            notes: `Retroactive Group Session assigned from Contract: ${officeGroup.groupType}`,
                            groupTopic: (existingSession as any)?.topic || `${officeGroup.groupType} Group`,
                            status: "PENDING",
                            groupSessionId: sessionId
                        }
                    })
                }
                
                currentScheduledHours += hoursToAdd
            }
        }
    }
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getContractsForStudent(studentId: string) {
    return (prisma as any).contract.findMany({
        where: { studentId },
        include: {
            supervisors: {
                include: {
                    supervisor: { include: { user: true } }
                }
            },
            groupAssignments: {
                include: {
                    supervisor: { select: { id: true, fullName: true, credentialType: true } },
                    officeGroup: { select: { id: true, name: true, groupType: true, dayOfWeek: true, startTime: true, endTime: true } }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    })
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createContract(data: {
    studentId: string
    supervisorIds: string[]
    mainSupervisorId: string
    groupAssignments?: Array<{ supervisorId: string; officeGroupId: string }>
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Only Office can create contracts" }

    const student = await prisma.student.findUnique({ where: { id: data.studentId }, include: { user: true } })
    if (!student) return { error: "Student not found" }

    const existingContract = await prisma.contract.findFirst({
        where: { studentId: data.studentId }
    })
    if (existingContract) {
        return { error: "Limitation: Solo se permite 1 contrato por estudiante." }
    }

    // Use student's profile start date as source of truth for contract effective date
    const profileStart = (student as any).startDate ? new Date((student as any).startDate) : new Date()
    const contractEffectiveDate = profileStart
    
    // Auto-merge group assignment supervisors into the contract as secondary ones (unless primary)
    const groupSupIds = data.groupAssignments?.map(g => g.supervisorId) || []
    const allSupervisors = Array.from(new Set([...data.supervisorIds, ...groupSupIds]))

    const contract = await prisma.contract.create({
        data: {
            studentId: data.studentId,
            effectiveDate: contractEffectiveDate,
            status: "SENT",
            supervisors: {
                create: allSupervisors.map(supId => ({
                    supervisorId: supId,
                    isMainSupervisor: supId === data.mainSupervisorId
                }))
            }
        }
    })

    // Save group assignments
    if (data.groupAssignments?.length) {
        await (prisma as any).contractGroupAssignment.createMany({
            data: data.groupAssignments.map(ga => ({
                contractId: contract.id,
                supervisorId: ga.supervisorId,
                officeGroupId: ga.officeGroupId
            })),
            skipDuplicates: true
        })

        // Schedule sessions based strictly on profile start date
        const startDate = profileStart
        const endDate = (student as any).endDate ? new Date((student as any).endDate) : new Date(startDate.getTime() + 365 * 2 * 24 * 60 * 60 * 1000)
        const planType = (student as any).fieldworkType || "REGULAR"
        await scheduleGroupSessions(data.studentId, data.groupAssignments, startDate, endDate, planType)
    }

    // Sync student profile supervisors
    if (data.mainSupervisorId) {
        await prisma.student.update({
            where: { id: data.studentId },
            data: { supervisorId: data.mainSupervisorId }
        })
    }
    
    await prisma.studentSupervisor.deleteMany({
        where: { studentId: data.studentId }
    })
    
    const ProfileSyncSupervisors = []
    if (data.mainSupervisorId) {
        ProfileSyncSupervisors.push({
            studentId: data.studentId,
            supervisorId: data.mainSupervisorId,
            isPrimary: true
        })
    }
    const secondaryIds = allSupervisors.filter(id => id !== data.mainSupervisorId)
    for (const secId of secondaryIds) {
        ProfileSyncSupervisors.push({
            studentId: data.studentId,
            supervisorId: secId,
            isPrimary: false
        })
    }
    if (ProfileSyncSupervisors.length > 0) {
        await prisma.studentSupervisor.createMany({
            data: ProfileSyncSupervisors
        })
    }


    // Notification + Email
    await (prisma as any).notification.create({
        data: {
            userId: (student as any).userId,
            title: "New Contract Needs Signature",
            message: "A new supervision contract has been generated for you. Please review and approve it.",
            type: "CONTRACT",
            link: "/student/contracts"
        }
    })

    await sendEmail({
        to: (student as any).email,
        subject: "Action Required: New Supervision Contract",
        html: `
            <h2>New Supervision Contract</h2>
            <p>Hello ${(student as any).fullName},</p>
            <p>A new ABA supervision contract has been generated for you with an effective date of ${contractEffectiveDate.toISOString().split("T")[0]}.</p>
            <p>Please log in to your dashboard to review and sign the contract.</p>
            <p><a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/student/contracts">Go to My Contracts</a></p>
        `
    })

    revalidatePath(`/office/students/${data.studentId}`)
    return { success: true, contractId: contract.id }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateContract(data: {
    contractId: string
    supervisorIds: string[]
    mainSupervisorId: string
    groupAssignments?: Array<{ supervisorId: string; officeGroupId: string }>
}) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Only Office can edit contracts" }

    const currentContract = await prisma.contract.findUnique({
        where: { id: data.contractId },
        include: { student: true }
    })
    if (!currentContract) return { error: "Contract not found" }

    const nextStatus = currentContract.status === "ACTIVE" ? "ACTIVE" : "SENT"

    await prisma.contractSupervisor.deleteMany({ where: { contractId: data.contractId } })
    await (prisma as any).contractGroupAssignment.deleteMany({ where: { contractId: data.contractId } })

    // Auto-merge group assignment supervisors into the contract as secondary ones (unless primary)
    const groupSupIds = data.groupAssignments?.map(g => g.supervisorId) || []
    const allSupervisors = Array.from(new Set([...data.supervisorIds, ...groupSupIds]))

    await prisma.contract.update({
        where: { id: data.contractId },
        data: {
            effectiveDate: (currentContract.student as any).startDate || new Date(),
            status: nextStatus,
            rejectionReason: nextStatus === "SENT" ? null : currentContract.rejectionReason,
            supervisors: {
                create: allSupervisors.map(supId => ({
                    supervisorId: supId,
                    isMainSupervisor: supId === data.mainSupervisorId
                }))
            }
        }
    })

    if (data.groupAssignments?.length) {
        await (prisma as any).contractGroupAssignment.createMany({
            data: data.groupAssignments.map(ga => ({
                contractId: data.contractId,
                supervisorId: ga.supervisorId,
                officeGroupId: ga.officeGroupId
            })),
            skipDuplicates: true
        })
        
        // Also ensure sessions are scheduled just like createContract does
        const startDate = (currentContract.student as any).startDate ? new Date((currentContract.student as any).startDate) : new Date()
        const endDate = (currentContract.student as any).endDate ? new Date((currentContract.student as any).endDate) : (() => { const d = new Date(startDate); d.setMonth(d.getMonth() + ((currentContract.student as any).totalMonths || 12)); return d })()
        const planType = (currentContract.student as any).fieldworkType || "REGULAR"
        
        // first delete any future attendance to avoid piling up if they change groups
        const todayZero = new Date(); todayZero.setHours(0,0,0,0)
        await (prisma as any).groupSupervisionAttendance.deleteMany({
            where: { studentId: currentContract.studentId, session: { date: { gte: todayZero } } }
        })

        // ALSO cleanup PENDING group hours to avoid duplicates on re-save
        await (prisma as any).supervisionHour.deleteMany({
            where: { 
                studentId: currentContract.studentId, 
                supervisionType: "GROUP", 
                status: "PENDING"
            }
        })
        
        await scheduleGroupSessions(currentContract.studentId, data.groupAssignments, startDate, endDate, planType)
    }

    if (data.mainSupervisorId) {
        await prisma.student.update({
            where: { id: currentContract.studentId },
            data: { supervisorId: data.mainSupervisorId }
        })
    }
    
    // Sync student profile supervisors
    await prisma.studentSupervisor.deleteMany({
        where: { studentId: currentContract.studentId }
    })
    
    const ProfileSyncSupervisors = []
    if (data.mainSupervisorId) {
        ProfileSyncSupervisors.push({
            studentId: currentContract.studentId,
            supervisorId: data.mainSupervisorId,
            isPrimary: true
        })
    }
    const secondaryIds = allSupervisors.filter(id => id !== data.mainSupervisorId)
    for (const secId of secondaryIds) {
        ProfileSyncSupervisors.push({
            studentId: currentContract.studentId,
            supervisorId: secId,
            isPrimary: false
        })
    }
    if (ProfileSyncSupervisors.length > 0) {
        await prisma.studentSupervisor.createMany({
            data: ProfileSyncSupervisors
        })
    }

    const contract = await prisma.contract.findUnique({ where: { id: data.contractId } })
    if (contract) revalidatePath(`/office/students/${contract.studentId}`)
    return { success: true }
}

// ── Delete / Approve / Reject / Resend (unchanged) ───────────────────────────

export async function deleteContract(contractId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Only Office can delete contracts" }
    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    await prisma.contract.delete({ where: { id: contractId } })
    if (contract) revalidatePath(`/office/students/${contract.studentId}`)
    return { success: true }
}

export async function approveContract(contractId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const student = await prisma.student.findUnique({ where: { userId: (session.user as any).id } })
    if (!student) return { error: "Student not found" }
    const contract = await prisma.contract.findUnique({ where: { id: contractId } })
    if (!contract || contract.studentId !== student.id) return { error: "Contract not found" }
    await prisma.contract.update({ where: { id: contractId }, data: { status: "ACTIVE" } })
    revalidatePath("/student/contracts")
    return { success: true }
}

export async function rejectContract(contractId: string, reason: string) {
    try {
        const session = await auth()
        if (!session?.user) return { error: "Unauthorized" }
        const student = await prisma.student.findUnique({ where: { userId: (session.user as any).id } })
        if (!student) return { error: "Student not found" }
        const contract = await prisma.contract.findUnique({ where: { id: contractId } })
        if (!contract || contract.studentId !== student.id) return { error: "Contract not found" }
        await prisma.contract.update({ where: { id: contractId }, data: { status: "REJECTED", rejectionReason: reason } })
        const officeUsers = await prisma.user.findMany({ where: { role: "OFFICE" } })
        if (officeUsers.length > 0) {
            await (prisma as any).notification.createMany({
                data: officeUsers.map(u => ({
                    userId: u.id, title: "Contract Rejected",
                    message: `${student.fullName} rejected a contract. Reason: ${reason}`,
                    type: "CONTRACT", link: `/office/students/${student.id}`
                }))
            })
        }
        revalidatePath("/student/contracts")
        revalidatePath(`/office/students/${student.id}`)
        return { success: true }
    } catch (err: any) {
        return { error: err.message || "Unexpected error" }
    }
}

export async function resendContract(contractId: string) {
    const session = await auth()
    if (!session?.user) return { error: "Unauthorized" }
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") return { error: "Only Office can resend contracts" }
    const contract = await prisma.contract.findUnique({ where: { id: contractId }, include: { student: true } })
    if (!contract) return { error: "Contract not found" }
    await prisma.contract.update({ where: { id: contractId }, data: { status: "SENT", rejectionReason: null } })
    await (prisma as any).notification.create({
        data: {
            userId: (contract.student as any).userId,
            title: "Contract Re-Sent",
            message: "A previously rejected contract has been updated and re-sent for your review.",
            type: "CONTRACT", link: "/student/contracts"
        }
    })
    revalidatePath(`/office/students/${contract.studentId}`)
    revalidatePath("/student/contracts")
    return { success: true }
}
