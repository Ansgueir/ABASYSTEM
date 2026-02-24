import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Download, Calendar, TrendingUp, ArrowUpRight } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { SupervisorPaymentsList } from "@/components/supervisor/payments-list"
import { ExportPaymentsButton } from "@/components/supervisor/export-payments-button"

export default async function SupervisorPaymentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    let supervisor = null
    let payments: any[] = []

    try {
        supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id }
        })

        if (supervisor) {
            const tempPayments = await prisma.supervisorPayment.findMany({
                where: { supervisorId: supervisor.id },
                include: { student: true },
                orderBy: { createdAt: 'desc' },
                take: 10
            })

            for (const p of tempPayments) {
                const start = new Date(p.monthYear)
                const end = new Date(p.monthYear)
                end.setMonth(end.getMonth() + 1)

                const hoursForPayment = await prisma.supervisionHour.findMany({
                    where: {
                        supervisorId: supervisor.id,
                        studentId: p.studentId,
                        date: {
                            gte: start,
                            lt: end
                        }
                    },
                    orderBy: { date: 'asc' }
                })

                payments.push({
                    ...p,
                    amountDue: Number(p.amountDue),
                    amountAlreadyPaid: Number(p.amountAlreadyPaid),
                    balanceDue: Number(p.balanceDue),
                    amountPaidThisMonth: Number(p.amountPaidThisMonth),
                    student: {
                        ...p.student,
                        hourlyRate: Number(p.student.hourlyRate),
                        supervisionPercentage: Number(p.student.supervisionPercentage),
                        amountToPay: Number(p.student.amountToPay)
                    },
                    hours: hoursForPayment.map(h => ({
                        ...h,
                        hours: Number(h.hours),
                        amountBilled: Number(h.amountBilled),
                        supervisorPay: Number(h.supervisorPay)
                    }))
                })
            }
        }
    } catch (error) {
        console.error("Error fetching payments:", error)
    }

    const pendingAmount = payments
        .reduce((sum, p) => sum + Number(p.balanceDue), 0)

    const totalEarned = payments
        .reduce((sum, p) => sum + Number(p.amountAlreadyPaid), 0)

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Payments</h1>
                        <p className="text-muted-foreground">View your earnings and payment history</p>
                    </div>
                    <ExportPaymentsButton payments={payments} />
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-warning" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pending Balance</p>
                                <p className="text-2xl font-bold">${pendingAmount.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Paid</p>
                                <p className="text-2xl font-bold">${totalEarned.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Commission Rate</p>
                                <p className="text-2xl font-bold">{Number(supervisor?.paymentPercentage || 0.54) * 100}%</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Payments List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Payment History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {payments.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No payments yet</p>
                            </div>
                        ) : (
                            <SupervisorPaymentsList payments={payments} />
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
