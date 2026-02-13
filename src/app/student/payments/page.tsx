import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Download, Calendar, CreditCard, ArrowUpRight } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"

export default async function PaymentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "student" && role !== "qa") redirect("/login")

    let student = null
    let invoices: any[] = []

    try {
        student = await prisma.student.findUnique({
            where: { userId: session.user.id }
        })

        if (student) {
            invoices = await prisma.invoice.findMany({
                where: { studentId: student.id },
                orderBy: { createdAt: 'desc' },
                take: 10
            })
        }
    } catch (error) {
        console.error("Error fetching payments:", error)
    }

    const pendingAmount = invoices
        .filter(i => i.status === 'pending')
        .reduce((sum, i) => sum + Number(i.amount), 0)

    return (
        <DashboardLayout role="student">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Payments</h1>
                        <p className="text-muted-foreground">View your invoices and payment history</p>
                    </div>
                    <Button variant="outline" className="rounded-xl">
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                    </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-2">
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
                                <CreditCard className="h-6 w-6 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Monthly Rate</p>
                                <p className="text-2xl font-bold">${Number(student?.amountToPay || 0).toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Invoices List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {invoices.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No invoices yet</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                                <Calendar className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">
                                                    Invoice #{invoice.id.slice(-6).toUpperCase()}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {format(new Date(invoice.createdAt), 'MMMM yyyy')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <p className="font-semibold">${Number(invoice.amount).toFixed(2)}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${invoice.status === 'paid'
                                                    ? 'bg-success/10 text-success'
                                                    : 'bg-warning/10 text-warning'
                                                    }`}>
                                                    {invoice.status}
                                                </span>
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
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
