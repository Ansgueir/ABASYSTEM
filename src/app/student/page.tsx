import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress, CircularProgress } from "@/components/ui/progress"
import { CalendarDays, Clock, DollarSign, ArrowRight, TrendingUp, BookOpen, Users } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { startOfMonth } from "date-fns"
import { LogHoursDialog } from "@/components/log-hours-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { SupervisorContactDialog } from "@/components/student/supervisor-contact-dialog"

export default async function StudentDashboard() {
    let session = null;
    try {
        session = await auth()
    } catch (error) {
        console.error("Auth session check failed:", error)
        redirect("/login")
    }

    if (!session || !session.user) {
        redirect("/login")
    }

    const role = String((session.user as any).role).toLowerCase();
    if (role !== "student" && role !== "qa") {
        redirect("/login")
    }

    // --- Database Fetching ---
    let student = null;
    let stats = {
        hoursThisMonth: 0,
        maxHours: 130,
        totalProgress: 0,
        totalRequired: 2000,
        nextPayment: 0,
        dueDate: "March 1st",
        supervisedHours: 0,
        independentHours: 0
    };
    let dbError = false;

    try {
        student = await prisma.student.findUnique({
            where: { userId: session.user.id },
            include: { supervisor: { include: { user: true } } }
        })

        if (student) {
            const currentMonthStart = startOfMonth(new Date())

            const [indepMonth, supMonth, indepTotal, supTotal, pendingInvoices] = await Promise.all([
                prisma.independentHour.aggregate({
                    where: { studentId: student.id, date: { gte: currentMonthStart } },
                    _sum: { hours: true }
                }),
                prisma.supervisionHour.aggregate({
                    where: { studentId: student.id, date: { gte: currentMonthStart } },
                    _sum: { hours: true }
                }),
                prisma.independentHour.aggregate({
                    where: { studentId: student.id },
                    _sum: { hours: true }
                }),
                prisma.supervisionHour.aggregate({
                    where: { studentId: student.id },
                    _sum: { hours: true }
                }),
                prisma.invoice.aggregate({
                    where: { studentId: student.id, status: { in: ['SENT', 'OVERDUE'] } },
                    _sum: { amountDue: true }
                })
            ])

            const independentHours = Number(indepMonth?._sum?.hours) || 0
            const supervisedHours = Number(supMonth?._sum?.hours) || 0
            const hoursThisMonth = independentHours + supervisedHours
            const totalProgress = (Number(indepTotal?._sum?.hours) || 0) + (Number(supTotal?._sum?.hours) || 0)

            stats = {
                hoursThisMonth,
                maxHours: Number(student.hoursPerMonth || 130),
                totalProgress,
                totalRequired: 2000,
                nextPayment: Number(pendingInvoices?._sum?.amountDue || 0),
                dueDate: "Currently Due",
                supervisedHours,
                independentHours
            }
        }
    } catch (error) {
        console.error("Database fetching failed:", error);
        dbError = true;
    }

    const displayName = student?.fullName?.split(' ')[0] || "Student";
    const progressPercent = Math.round((stats.totalProgress / stats.totalRequired) * 100)

    // Right Panel Component
    const rightPanel = (
        <div className="space-y-6">
            {/* Profile Card */}
            <div className="text-center">
                <CircularProgress value={progressPercent} size={140} strokeWidth={12}>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-primary">{progressPercent}%</span>
                    </div>
                </CircularProgress>
                <h3 className="mt-4 text-lg font-semibold">Good Morning, {displayName}! 👋</h3>
                <p className="text-sm text-muted-foreground">Continue your learning to achieve your target!</p>
            </div>

            {/* Monthly Stats */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">This Month</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-sm text-muted-foreground">Supervised</span>
                        </div>
                        <span className="font-medium">{stats.supervisedHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-accent" />
                            <span className="text-sm text-muted-foreground">Independent</span>
                        </div>
                        <span className="font-medium">{stats.independentHours.toFixed(1)}h</span>
                    </div>
                </CardContent>
            </Card>

            {/* Supervisor */}
            {student?.supervisor && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Your Supervisor</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                    {student.supervisor.fullName.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <p className="font-medium">{student.supervisor.fullName}</p>
                                <p className="text-sm text-muted-foreground">BCBA</p>
                            </div>
                            <SupervisorContactDialog supervisor={student.supervisor} />
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )

    return (
        <DashboardLayout role="student" rightPanel={rightPanel}>
            <div className="space-y-8">
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl gradient-hero p-8 text-white">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-white/80 uppercase tracking-wider">ABA Supervision</p>
                        <h1 className="mt-2 text-3xl font-bold">Track Your Progress Towards Certification</h1>
                        <p className="mt-2 text-white/80 max-w-lg">Log your hours, stay on top of supervision requirements, and achieve your goals.</p>
                        <div className="mt-6">
                            <LogHoursDialog />
                        </div>
                    </div>
                    {/* Decorative elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
                        <svg viewBox="0 0 200 200" className="w-full h-full">
                            <path fill="currentColor" d="M47.5,-57.2C59.9,-46.8,67.5,-30.5,70.3,-13.4C73.1,3.7,71.1,21.6,62.5,35.8C53.9,50,38.7,60.5,22.1,66.2C5.5,71.9,-12.5,72.8,-28.8,67.1C-45.1,61.4,-59.7,49.1,-67.8,33.3C-75.9,17.5,-77.5,-1.8,-72.2,-18.8C-66.9,-35.8,-54.7,-50.5,-40.4,-60.5C-26.1,-70.5,-9.7,-75.8,4.3,-80.8C18.3,-85.8,35.1,-67.5,47.5,-57.2Z" transform="translate(100 100)" />
                        </svg>
                    </div>
                </div>

                {/* Alert if DB error */}
                {dbError && (
                    <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
                        <p className="text-sm text-destructive font-medium">⚠️ Some data could not be loaded. Please refresh the page.</p>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <Card className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Hours This Month</CardTitle>
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.hoursThisMonth.toFixed(1)}<span className="text-lg text-muted-foreground font-normal ml-1">/ {stats.maxHours}</span></div>
                            <Progress value={(stats.hoursThisMonth / stats.maxHours) * 100} className="mt-4 h-2" />
                            <p className="text-xs text-muted-foreground mt-2">{Math.round((stats.hoursThisMonth / stats.maxHours) * 100)}% of monthly cap</p>
                        </CardContent>
                    </Card>

                    <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Progress</CardTitle>
                            <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-success" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{stats.totalProgress.toFixed(0)}<span className="text-lg text-muted-foreground font-normal ml-1">/ {stats.totalRequired}</span></div>
                            <Progress
                                value={(stats.totalProgress / stats.totalRequired) * 100}
                                className="mt-4 h-2"
                                indicatorClassName="bg-success"
                            />
                            <p className="text-xs text-muted-foreground mt-2">{progressPercent}% towards certification</p>
                        </CardContent>
                    </Card>

                    <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Balance</CardTitle>
                            <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-warning" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">${stats.nextPayment.toFixed(2)}</div>
                            <p className="text-sm text-muted-foreground mt-1">{stats.dueDate}</p>
                            <Button variant="link" className="px-0 text-primary h-auto mt-2 text-sm" asChild>
                                <a href="/student/payments">
                                    View Payments <ArrowRight className="ml-1 h-4 w-4" />
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Actions */}
                <div className="grid gap-4 md:grid-cols-2">
                    <Link href="/student/timesheet" className="block outline-none">
                        <Card className="cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-1 h-full">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <BookOpen className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">View Timesheet</h3>
                                    <p className="text-sm text-muted-foreground">Review and manage your logged hours</p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/student/groups" className="block outline-none">
                        <Card className="cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-1 h-full">
                            <CardContent className="flex items-center gap-4 p-6">
                                <div className="h-12 w-12 rounded-xl bg-accent/30 flex items-center justify-center">
                                    <Users className="h-6 w-6 text-accent-foreground" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold">Group Sessions</h3>
                                    <p className="text-sm text-muted-foreground">Join upcoming group supervision</p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </DashboardLayout>
    )
}
