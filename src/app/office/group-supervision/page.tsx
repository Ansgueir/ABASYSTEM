// @ts-nocheck
import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { GroupSupervisionClientView } from "./group-supervision-client-view"

export default async function GroupSupervisionPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const supervisors = await prisma.supervisor.findMany({
        where: { user: { isHidden: false } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const groupSessions = await prisma.groupSupervisionSession.findMany({
        include: {
            supervisor: { select: { id: true, fullName: true } },
            group: { select: { id: true, name: true } },
            attendance: {
                include: { student: { select: { id: true, fullName: true } } }
            }
        },
        orderBy: { date: 'desc' }
    })

    const mappedSessions = groupSessions.map(({ attendance, supervisor, group, ...sess }) => ({
        ...sess,
        supervisor: { id: supervisor.id, fullName: supervisor.fullName },
        groupName: group?.name || "Unlinked",
        participants: attendance.map(a => ({
            id: a.id,
            studentId: a.studentId,
            student: a.student ? { fullName: a.student.fullName } : undefined
        }))
    }))

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-800 to-indigo-600 bg-clip-text text-transparent">Group Supervision</h1>
                        <p className="text-muted-foreground text-sm font-medium">Organization-wide view of all group supervision sessions</p>
                    </div>
                </div>

                {/* Main Content (Calendar/List Switcher) */}
                <GroupSupervisionClientView 
                    sessions={mappedSessions} 
                    supervisors={supervisors} 
                />
            </div>
        </DashboardLayout>
    )
}

