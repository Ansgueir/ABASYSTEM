import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Calendar, Clock, BookOpen } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"

export default async function StudentGroupsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "student" && role !== "qa") redirect("/login")

    let student = null
    let groupAttendances: any[] = []

    try {
        student = await prisma.student.findUnique({
            where: { userId: session.user.id }
        })

        if (student) {
            groupAttendances = await prisma.groupSupervisionAttendance.findMany({
                where: { studentId: student.id },
                include: {
                    session: {
                        include: { supervisor: true, attendance: true }
                    }
                },
                orderBy: {
                    session: { date: 'desc' }
                }
            })
        }
    } catch (error) {
        console.error("Error fetching student groups:", error)
    }

    const upcomingSessions = groupAttendances.filter(a => new Date(a.session.date) >= new Date())
    const pastSessions = groupAttendances.filter(a => new Date(a.session.date) < new Date())

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Group Sessions</h1>
                        <p className="text-muted-foreground">View your enrolled group supervision sessions</p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Upcoming Sessions */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" /> Upcoming Sessions
                        </h2>
                        {upcomingSessions.length === 0 ? (
                            <Card className="bg-muted/30 border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                        <Users className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="font-medium text-lg mb-1">No Upcoming Groups</h3>
                                    <p className="text-sm text-muted-foreground max-w-sm">
                                        You are not currently enrolled in any upcoming group supervision sessions. Supervisors or Office Admins handle enrollment.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {upcomingSessions.map(({ session: s }) => (
                                    <Card key={s.id} className="hover:shadow-md transition-shadow relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base font-semibold line-clamp-2">{s.topic}</CardTitle>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                                By {s.supervisor?.fullName}
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>{format(new Date(s.date), 'MMMM d, yyyy')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="h-4 w-4" />
                                                    <span>{format(new Date(s.startTime), 'h:mm a')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Users className="h-4 w-4" />
                                                    <span>{s.attendance.length} / {s.maxStudents} Students Enrolled</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Past Sessions */}
                    <section>
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                            <BookOpen className="h-5 w-5" /> Past Required Sessions
                        </h2>
                        {pastSessions.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No historical group sessions found.</p>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {pastSessions.map(({ session: s, attended }) => (
                                    <Card key={s.id} className="bg-muted/30">
                                        <CardHeader className="pb-3">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base font-medium text-foreground/80 line-clamp-2">{s.topic}</CardTitle>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${attended ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                                    {attended ? 'ATTENDED' : 'MISSED'}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                By {s.supervisor?.fullName}
                                            </p>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="h-3 w-3" />
                                                    <span>{format(new Date(s.date), 'MMM d, yyyy')}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    <span>{format(new Date(s.startTime), 'h:mm a')}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </DashboardLayout>
    )
}
