import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Clock, Calendar, Plus, Filter } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogSupervisionDialog } from "@/components/log-supervision-dialog"

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
            include: { students: true }
        })

        if (supervisor) {
            hours = await prisma.supervisionHour.findMany({
                where: { supervisorId: supervisor.id },
                orderBy: { date: 'desc' },
                take: 20,
                include: { student: true }
            })
        }
    } catch (error) {
        console.error("Error fetching timesheet:", error)
    }

    const serializedStudents = supervisor?.students.map(student => ({
        ...student,
        supervisionPercentage: Number(student.supervisionPercentage),
        hoursToDo: student.hoursToDo ? Number(student.hoursToDo) : null,
        hoursToPay: student.hoursToPay ? Number(student.hoursToPay) : null,
        amountToPay: student.amountToPay ? Number(student.amountToPay) : null,
        hoursPerMonth: student.hoursPerMonth ? Number(student.hoursPerMonth) : null,
        totalMonths: student.totalMonths ? Number(student.totalMonths) : null,
    })) || []

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
                        <Button variant="outline" className="rounded-xl">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                        <LogSupervisionDialog students={serializedStudents} />
                    </div>
                </div>

                {/* Hours List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {hours.length === 0 ? (
                            <div className="text-center py-12">
                                <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No supervision hours logged yet</p>
                                <p className="text-muted-foreground">No supervision hours logged yet</p>
                                <div className="mt-4">
                                    <LogSupervisionDialog students={serializedStudents} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {hours.map((hour) => (
                                    <div
                                        key={hour.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border-2 border-primary/20">
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {hour.student?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{hour.student?.fullName || 'Student'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(hour.date), 'MMM d, yyyy')}
                                                    {hour.sessionType && <span> • {hour.sessionType}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-semibold">{Number(hour.hours).toFixed(1)}h</p>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${hour.status === 'approved'
                                                ? 'bg-success/10 text-success'
                                                : 'bg-warning/10 text-warning'
                                                }`}>
                                                {hour.status || 'pending'}
                                            </span>
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
