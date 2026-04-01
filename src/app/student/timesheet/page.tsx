import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Calendar, Filter, Download, Plus } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { LogHoursDialog } from "@/components/log-hours-dialog"
import { StudentStats } from "@/components/student-stats"
import { HourDetailsDialog } from "@/components/student/hour-details-dialog"
import { TimesheetClientView } from "./timesheet-client-view"

export default async function TimesheetPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "student" && role !== "qa") redirect("/login")

    // Fetch student and hours
    let hours: any[] = []
    let student = null

    try {
        student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            include: { 
                supervisors: {
                    include: { supervisor: true }
                } 
            }
        })

        if (student) {
            const [indepHours, supHours, groupAtt] = await Promise.all([
                prisma.independentHour.findMany({
                    where: { studentId: student.id },
                    orderBy: { date: 'desc' },
                    take: 100
                }),
                prisma.supervisionHour.findMany({
                    where: { studentId: student.id },
                    orderBy: { date: 'desc' },
                    take: 100,
                    include: { supervisor: true }
                }),
                prisma.groupSupervisionAttendance.findMany({
                    where: { studentId: student.id, attended: true },
                    include: { session: { include: { supervisor: true } } },
                    orderBy: { session: { date: 'desc' } },
                    take: 50
                })
            ])
            
            const existingHourDates = new Set(supHours.map(h => `${h.date.toISOString()}-${h.startTime.toISOString()}-${h.supervisionType}`))

            hours = [
                ...indepHours.map(h => ({
                    ...h,
                    hours: Number(h.hours),
                    type: 'independent' as const
                })),
                ...supHours.map(h => ({
                    ...h,
                    hours: Number(h.hours),
                    amountBilled: h.amountBilled ? Number(h.amountBilled) : null,
                    supervisorPay: h.supervisorPay ? Number(h.supervisorPay) : null,
                    type: 'supervised' as const
                })),
                ...groupAtt
                    .filter(a => !existingHourDates.has(`${a.session.date.toISOString()}-${a.session.startTime.toISOString()}-GROUP`))
                    .map(a => ({
                        id: a.id,
                        date: a.session.date,
                        startTime: a.session.startTime,
                        hours: 1, // Default for historical
                        supervisionType: 'GROUP',
                        groupTopic: a.session.topic,
                        status: 'PENDING',
                        supervisor: a.session.supervisor,
                        type: 'supervised' as const
                    }))
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }
    } catch (error) {
        console.error("Error fetching timesheet:", error)
    }

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Timesheet</h1>
                        <p className="text-muted-foreground">Track and manage your logged hours</p>
                    </div>
                    <div className="flex gap-2">
                        <LogHoursDialog 
                            disabled={!student?.supervisors || student.supervisors.length === 0} 
                            disabledMessage="You cannot log hours yet. Please contact the Office to have a Supervisor assigned to your profile."
                        />
                        <Button variant="outline" className="rounded-xl" asChild>
                            <a href="/api/student/timesheet/export" target="_blank">
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Monthly Stats */}
                {student && <StudentStats studentId={student.id} />}

                {/* Calendar View */}
                {student && (
                    <TimesheetClientView hours={hours} />
                )}
            </div>
        </DashboardLayout>
    )
}
