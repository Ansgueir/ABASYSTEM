import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CreateGroupSessionDialog } from "@/components/create-group-session-dialog"
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

    const students = await prisma.student.findMany({
        where: { status: 'ACTIVE', user: { isHidden: false } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const groupSessions = await prisma.groupSupervisionSession.findMany({
        include: {
            supervisor: true,
            attendance: {
                include: { student: true }
            }
        },
        orderBy: { date: 'desc' }
    })

    const mappedSessions = groupSessions.map(({ attendance, supervisor, ...session }) => ({
        ...session,
        supervisor: { fullName: supervisor.fullName },
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
                        <p className="text-muted-foreground text-sm font-medium">Manage group supervision sessions (max 10 students)</p>
                    </div>
                    <div className="flex gap-2">
                        <CreateGroupSessionDialog supervisors={supervisors} students={students} />
                    </div>
                </div>

                {/* Main Content (Calendar/List Switcher) */}
                <GroupSupervisionClientView 
                    sessions={mappedSessions} 
                    supervisors={supervisors} 
                    students={students} 
                />
            </div>
        </DashboardLayout>
    )
}
