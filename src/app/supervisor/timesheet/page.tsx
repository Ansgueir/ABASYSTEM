import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Filter } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { LogHoursDialog } from "@/components/log-hours-dialog"
import { serialize } from "@/lib/serialize"
import { SupervisorTimesheetClientView } from "./supervisor-timesheet-client-view"

export default async function SupervisorTimesheetPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    let hours: any[] = []
    let supervisor = null

    try {
        supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id },
            include: { 
                studentAssignments: { include: { student: true } },
                students: true 
            }
        })
 
        if (supervisor) {
            const nmIds = (supervisor as any).studentAssignments.map((a: any) => a.studentId)
            const legacyIds = (supervisor as any).students.map((s: any) => s.id)
            const allAssignedIds = Array.from(new Set([...nmIds, ...legacyIds]))
            
            const [superLogs, indepLogs, groupOwnerSessions] = await Promise.all([
                prisma.supervisionHour.findMany({
                    where: { 
                        supervisorId: supervisor.id,
                        status: { not: 'REJECTED' }
                    },
                    orderBy: { date: 'desc' },
                    take: 100,
                    include: { student: true }
                }),
                prisma.independentHour.findMany({
                    where: { 
                        studentId: { in: allAssignedIds },
                        status: { not: 'REJECTED' }
                    },
                    orderBy: { date: 'desc' },
                    take: 50,
                    include: { student: true }
                }),
                prisma.groupSupervisionSession.findMany({
                    where: { supervisorId: supervisor.id },
                    include: { attendance: { include: { student: true } } },
                    orderBy: { date: 'desc' },
                    take: 20
                })
            ])

            const existingLogs = new Set(superLogs.map(l => `${l.studentId}-${l.date.toISOString()}-${l.startTime.toISOString()}`))

            const groupFallbacks: any[] = []
            for (const session of groupOwnerSessions) {
                for (const att of session.attendance) {
                    const key = `${att.studentId}-${session.date.toISOString()}-${session.startTime.toISOString()}`
                    if (!existingLogs.has(key)) {
                        groupFallbacks.push({
                            id: att.id,
                            studentId: att.studentId,
                            date: session.date,
                            startTime: session.startTime,
                            hours: 1,
                            supervisionType: 'GROUP',
                            groupTopic: session.topic,
                            status: 'PENDING',
                            student: att.student,
                            type: 'SUPERVISED'
                        })
                    }
                }
            }

            const combined = [
                ...superLogs.map(l => ({ ...l, type: 'SUPERVISED' })),
                ...indepLogs.map(l => ({ ...l, type: 'INDEPENDENT', supervisionType: 'N/A' })),
                ...groupFallbacks
            ]

            const raw = combined
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 50)
 
            hours = (raw as any[]).map(x => ({
                ...x,
                hours: Number(x.hours),
                amountBilled: x.amountBilled ? Number(x.amountBilled) : 0,
                supervisorPay: x.supervisorPay ? Number(x.supervisorPay) : 0,
                student: {
                    ...x.student,
                    hourlyRate: Number(x.student.hourlyRate),
                    supervisionPercentage: Number(x.student.supervisionPercentage),
                    amountToPay: Number(x.student.amountToPay)
                }
            }))
        }
    } catch (error) {
        console.error("Error fetching timesheet:", error)
    }

    const nmStudents = supervisor?.studentAssignments?.map((a: any) => a.student) || []
    const legacyStudents = supervisor?.students || []
    const allStudentsMap = new Map<string, any>()
    for (const s of [...nmStudents, ...legacyStudents]) {
        if (s?.id) allStudentsMap.set(s.id, s)
    }
    const allStudents = Array.from(allStudentsMap.values())
    const serializedStudents = serialize(allStudents.map((s: any) => ({ id: s.id, fullName: s.fullName })))

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Timesheet Entry</h1>
                        <p className="text-muted-foreground">Log and manage your supervision hours</p>
                    </div>
                    <div className="flex gap-2">
                        <LogHoursDialog students={serializedStudents} />
                    </div>
                </div>

                <SupervisorTimesheetClientView hours={hours} students={allStudents} />
            </div>
        </DashboardLayout>
    )
}
