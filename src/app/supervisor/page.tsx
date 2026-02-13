import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress, CircularProgress } from "@/components/ui/progress"
import { Users, Clock, DollarSign, TrendingUp, ArrowRight, Calendar } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { startOfMonth } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

export default async function SupervisorDashboard() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    let supervisor = null
    let students: any[] = []
    let stats = {
        totalStudents: 0,
        hoursThisMonth: 0,
        pendingEarnings: 0,
        completedSessions: 0
    }

    try {
        supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id },
            include: {
                students: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        })

        if (supervisor) {
            students = supervisor.students
            stats.totalStudents = supervisor.students.length

            const currentMonthStart = startOfMonth(new Date())
            const hoursAgg = await prisma.supervisionHour.aggregate({
                where: {
                    supervisorId: supervisor.id,
                    date: { gte: currentMonthStart }
                },
                _sum: { hours: true }
            })
            stats.hoursThisMonth = Number(hoursAgg._sum?.hours) || 0
        }
    } catch (error) {
        console.error("Error fetching supervisor data:", error)
    }

    const displayName = supervisor?.fullName?.split(' ')[0] || "Supervisor"

    // Right Panel
    const rightPanel = (
        <div className="space-y-6">
            <div className="text-center">
                <CircularProgress value={75} size={140} strokeWidth={12}>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-primary">{stats.totalStudents}</span>
                        <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                </CircularProgress>
                <h3 className="mt-4 text-lg font-semibold">Welcome, {displayName}! 👋</h3>
                <p className="text-sm text-muted-foreground">Manage your students and sessions</p>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start rounded-xl" asChild>
                        <Link href="/supervisor/timesheet">
                            <Clock className="h-4 w-4 mr-2" />
                            Log Supervision Hours
                        </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start rounded-xl" asChild>
                        <Link href="/supervisor/students">
                            <Users className="h-4 w-4 mr-2" />
                            View My Students
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )

    return (
        <DashboardLayout role="supervisor" rightPanel={rightPanel}>
            <div className="space-y-8">
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl gradient-hero p-8 text-white">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Supervisor Portal</p>
                        <h1 className="mt-2 text-3xl font-bold">Manage Your Supervision Sessions</h1>
                        <p className="mt-2 text-white/80 max-w-lg">Track student progress, log hours, and manage your earnings.</p>
                        <div className="mt-6">
                            <Button variant="secondary" className="rounded-xl bg-white/20 hover:bg-white/30 border-0 text-white" asChild>
                                <Link href="/supervisor/timesheet">
                                    <Clock className="h-4 w-4 mr-2" />
                                    Log Hours
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Users className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Students</p>
                                    <p className="text-2xl font-bold">{stats.totalStudents}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                                    <Clock className="h-6 w-6 text-success" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Hours This Month</p>
                                    <p className="text-2xl font-bold">{stats.hoursThisMonth.toFixed(1)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                                    <DollarSign className="h-6 w-6 text-warning" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Pending Earnings</p>
                                    <p className="text-2xl font-bold">${stats.pendingEarnings.toFixed(0)}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="animate-slide-up" style={{ animationDelay: '300ms' }}>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
                                    <Calendar className="h-6 w-6 text-accent-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Sessions</p>
                                    <p className="text-2xl font-bold">{stats.completedSessions}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Students */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-lg">My Students</CardTitle>
                        <Button variant="ghost" size="sm" className="text-primary" asChild>
                            <Link href="/supervisor/students">
                                View All <ArrowRight className="h-4 w-4 ml-1" />
                            </Link>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {students.length === 0 ? (
                            <div className="text-center py-8">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No students assigned yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {students.map((student) => (
                                    <div
                                        key={student.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <Avatar className="h-10 w-10 border-2 border-primary/20">
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {student.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{student.fullName}</p>
                                                <p className="text-sm text-muted-foreground">{student.academicDegree || 'Student'}</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="rounded-xl">
                                            View <ArrowRight className="h-4 w-4 ml-1" />
                                        </Button>
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
