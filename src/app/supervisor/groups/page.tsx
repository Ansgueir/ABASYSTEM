import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { CreateGroupSessionDialog } from "@/components/create-group-session-dialog"
import { Users, Calendar, Clock } from "lucide-react"

export default async function SupervisorGroupsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    const supervisor = await prisma.supervisor.findUnique({
        where: { userId: session.user.id },
        include: {
            groupSessions: {
                orderBy: { date: 'desc' },
                include: { attendance: true }
            }
        }
    })

    const students = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const sessions = supervisor?.groupSessions || []

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Group Supervision</h1>
                        <p className="text-muted-foreground">Manage your group sessions and attendance</p>
                    </div>
                    <CreateGroupSessionDialog students={students} />
                </div>

                {sessions.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No sessions created yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sessions.map((session) => (
                            <Card key={session.id} className="hover:shadow-md transition-all">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-semibold">{session.topic}</CardTitle>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${session.attendance.length >= session.maxStudents ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                                            {session.attendance.length} / {session.maxStudents}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground flex items-center mt-1">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {format(new Date(session.date), "PPP")}
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {format(new Date(session.startTime), "p")}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {session.attendance.length === 0 ? "No students registered yet" : `${session.attendance.length} students registered`}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
