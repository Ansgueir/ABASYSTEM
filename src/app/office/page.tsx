import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress, CircularProgress } from "@/components/ui/progress"
import { Users, GraduationCap, DollarSign, TrendingUp, ArrowRight, Clock, AlertCircle } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { startOfMonth } from "date-fns"
import Link from "next/link"
import { OfficeStatsGrid } from "@/components/office/office-stats-grid"

export default async function OfficeDashboard() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let stats = {
        totalStudents: 0,
        totalSupervisors: 0,
        pendingPayments: 0,
        totalPaidOut: 0,
        activeStudents: 0,
        pendingDocuments: 0
    }

    try {
        const startOfCurrentMonth = startOfMonth(new Date())
        const [studentCount, supervisorCount, pendingInvoices, paidInvoicesAgg] = await Promise.all([
            prisma.student.count(),
            prisma.supervisor.count(),
            prisma.invoice.count({ where: { status: 'SENT' } }),
            prisma.invoice.aggregate({
                where: { status: 'PAID', createdAt: { gte: startOfCurrentMonth } },
                _sum: { amountPaid: true }
            })
        ])

        stats.totalStudents = studentCount
        stats.totalSupervisors = supervisorCount
        stats.pendingPayments = pendingInvoices
        stats.totalPaidOut = Number(paidInvoicesAgg._sum?.amountPaid || 0)
        stats.activeStudents = studentCount // For now, all are active
    } catch (error) {
        console.error("Error fetching stats:", error)
    }

    // Right Panel
    const rightPanel = (
        <div className="space-y-6">
            <div className="text-center">
                <CircularProgress value={85} size={140} strokeWidth={12}>
                    <div className="text-center">
                        <span className="text-2xl font-bold text-primary">{stats.activeStudents}</span>
                        <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                </CircularProgress>
                <h3 className="mt-4 text-lg font-semibold">System Overview</h3>
                <p className="text-sm text-muted-foreground">Real-time platform statistics</p>
            </div>

            {stats.pendingPayments > 0 && (
                <Card className="border-warning/50 bg-warning/5">
                    <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                            <div>
                                <p className="font-medium text-warning">Pending Payments</p>
                                <p className="text-sm text-muted-foreground">
                                    {stats.pendingPayments} invoices awaiting payment
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start rounded-xl" asChild>
                        <Link href="/office/students">
                            <GraduationCap className="h-4 w-4 mr-2" />
                            Manage Students
                        </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start rounded-xl" asChild>
                        <Link href="/office/payments">
                            <DollarSign className="h-4 w-4 mr-2" />
                            Process Payments
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )

    return (
        <DashboardLayout role="office" rightPanel={rightPanel}>
            <div className="space-y-8">
                {/* Hero Banner */}
                <div className="relative overflow-hidden rounded-2xl gradient-hero p-8 text-white">
                    <div className="relative z-10">
                        <p className="text-sm font-medium text-white/80 uppercase tracking-wider">Admin Portal</p>
                        <h1 className="mt-2 text-3xl font-bold">ABA Supervision Management</h1>
                        <p className="mt-2 text-white/80 max-w-lg">Monitor students, supervisors, and payments from one dashboard.</p>
                        <div className="mt-6">
                            <Button variant="secondary" className="rounded-xl bg-white/20 hover:bg-white/30 border-0 text-white" asChild>
                                <Link href="/office/students">
                                    <Users className="h-4 w-4 mr-2" />
                                    View All Users
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <OfficeStatsGrid initialStats={stats} />

                {/* Quick Links */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Link href="/office/students">
                        <Card className="hover:shadow-elevated transition-all cursor-pointer">
                            <CardContent className="pt-6">
                                <GraduationCap className="h-8 w-8 text-primary mb-4" />
                                <h3 className="font-semibold">Student Management</h3>
                                <p className="text-sm text-muted-foreground mt-1">Add, edit, and manage student records</p>
                                <Button variant="ghost" size="sm" className="mt-4 p-0 h-auto text-primary">
                                    Go to Students <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/office/supervisors">
                        <Card className="hover:shadow-elevated transition-all cursor-pointer">
                            <CardContent className="pt-6">
                                <Users className="h-8 w-8 text-success mb-4" />
                                <h3 className="font-semibold">Supervisor Management</h3>
                                <p className="text-sm text-muted-foreground mt-1">Manage supervisors and assignments</p>
                                <Button variant="ghost" size="sm" className="mt-4 p-0 h-auto text-success">
                                    Go to Supervisors <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/office/payments">
                        <Card className="hover:shadow-elevated transition-all cursor-pointer">
                            <CardContent className="pt-6">
                                <DollarSign className="h-8 w-8 text-warning mb-4" />
                                <h3 className="font-semibold">Payment Processing</h3>
                                <p className="text-sm text-muted-foreground mt-1">Process invoices and track payments</p>
                                <Button variant="ghost" size="sm" className="mt-4 p-0 h-auto text-warning">
                                    Go to Payments <ArrowRight className="h-4 w-4 ml-1" />
                                </Button>
                            </CardContent>
                        </Card>
                    </Link>
                </div>
            </div>
        </DashboardLayout>
    )
}
