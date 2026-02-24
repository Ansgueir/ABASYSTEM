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
            where: { userId: session.user.id }
        })

        if (student) {
            const [indepHours, supHours] = await Promise.all([
                prisma.independentHour.findMany({
                    where: { studentId: student.id },
                    orderBy: { date: 'desc' },
                    take: 20
                }),
                prisma.supervisionHour.findMany({
                    where: { studentId: student.id },
                    orderBy: { date: 'desc' },
                    take: 20,
                    include: { supervisor: true }
                })
            ])

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
                        <Button variant="outline" className="rounded-xl">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                        <LogHoursDialog />
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

                {/* Hours List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Hours</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {hours.length === 0 ? (
                            <div className="text-center py-12">
                                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No hours logged yet</p>
                                <p className="text-muted-foreground">No hours logged yet</p>
                                <div className="mt-4">
                                    <LogHoursDialog />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {hours.slice(0, 10).map((hour, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${hour.type === 'supervised'
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-accent/30 text-accent-foreground'
                                                }`}>
                                                <Clock className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    {hour.type === 'supervised' ? 'Supervised' : 'Independent'} Hours
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(hour.date), 'MMM d, yyyy')}
                                                    {hour.type === 'supervised' && hour.supervisor && (
                                                        <span> • with {hour.supervisor.fullName}</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="font-semibold">{Number(hour.hours).toFixed(1)}h</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${hour.status === 'approved'
                                                    ? 'bg-success/10 text-success'
                                                    : hour.status === 'pending'
                                                        ? 'bg-warning/10 text-warning'
                                                        : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {hour.status?.toUpperCase() || 'LOGGED'}
                                                </span>
                                            </div>
                                            <HourDetailsDialog hour={hour} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
