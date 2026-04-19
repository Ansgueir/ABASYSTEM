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

    // Load all OfficeGroups with their assigned supervisors
    const officeGroups = await (prisma as any).officeGroup.findMany({
        include: {
            supervisors: {
                include: {
                    supervisor: { select: { id: true, fullName: true } }
                }
            }
        }
    })

    // Load actual sessions with attendance for the next 8 weeks (to show real student enrollment)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eightWeeksOut = new Date(today)
    eightWeeksOut.setDate(eightWeeksOut.getDate() + 56)

    const actualSessions = await (prisma as any).groupSupervisionSession.findMany({
        where: { date: { gte: today, lte: eightWeeksOut } },
        include: {
            supervisor: { select: { id: true, fullName: true } },
            attendance: {
                include: { student: { select: { id: true, fullName: true } } }
            }
        }
    })

    // Serialize for client
    const serialize = (obj: any): any => JSON.parse(JSON.stringify(obj, (_, v) =>
        typeof v === "bigint" ? v.toString() : v
    ))

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
                    officeGroups={serialize(officeGroups)}
                    actualSessions={serialize(actualSessions)}
                    supervisors={supervisors} 
                />
            </div>
        </DashboardLayout>
    )
}

