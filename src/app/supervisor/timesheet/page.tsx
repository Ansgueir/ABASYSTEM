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
import { serialize } from "@/lib/serialize"
import { SupervisorSessionsList } from "@/components/supervisor/sessions-list"

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
            const raw = await prisma.supervisionHour.findMany({
                where: { supervisorId: supervisor.id },
                orderBy: { date: 'desc' },
                take: 20,
                include: { student: true }
            })

            hours = raw.map(x => ({
                ...x,
                hours: Number(x.hours),
                amountBilled: x.amountBilled ? Number(x.amountBilled) : null,
                supervisorPay: x.supervisorPay ? Number(x.supervisorPay) : null,
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

    const serializedStudents = serialize(supervisor?.students || [])

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
                            <SupervisorSessionsList hours={hours} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
