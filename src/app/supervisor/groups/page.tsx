import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { CreateGroupSessionDialog } from "@/components/create-group-session-dialog"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Users, Calendar, Clock, Eye } from "lucide-react"

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
                include: { attendance: { include: { student: true } } }
            }
        }
    })

    const students = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const rawSessions = supervisor?.groupSessions || []

    // Map properties for UI compatibility and exclude Decimal objects from the Student model
    // Map properties for UI compatibility and exclude Decimal objects from the Student model
    const sessions = rawSessions.map(({ attendance, ...session }) => ({
        ...session,
        participants: attendance.map(a => ({
            id: a.id,
            studentId: a.studentId,
            student: a.student ? { fullName: a.student.fullName } : undefined
        })),
        attendance: undefined // Clear it completely from the payload although we need length later, wait length is already not an issue since it's a number, but `attendance` itself is an array of objects.
    }))

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
                            <GroupSessionDetailsDialog key={session.id} session={session} students={students}>
                                <Card className="hover:shadow-md transition-all cursor-pointer text-left">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg font-semibold">{session.topic}</CardTitle>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${session.participants.length >= session.maxStudents ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                                                {session.participants.length} / {session.maxStudents}
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
                                        <div className="flex items-center justify-between mt-4">
                                            <div className="text-xs text-muted-foreground">
                                                {session.participants.length === 0 ? "No students registered yet" : `${session.participants.length} students registered`}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-primary/5 text-primary hover:bg-primary/15" asChild>
                                                <div><Eye className="h-4 w-4" /></div>
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </GroupSessionDetailsDialog>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
