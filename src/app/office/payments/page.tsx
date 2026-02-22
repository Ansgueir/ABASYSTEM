import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DollarSign, Download, Filter, Calendar, ArrowUpRight, CheckCircle, Clock } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { GenerateInvoicesButton } from "@/components/office/generate-invoices-button"
import { PaymentsTable } from "@/components/office/payments-table"

export default async function OfficePaymentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let invoices: any[] = []
    let stats = { pending: 0, paid: 0, total: 0 }
    let unbilledTotal = 0

    try {
        invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { student: true }
        })

        // Simple stats calculation on fetched items (approximate)
        // Ideally should be aggregate queries for accuracy on full dataset
        const allInvoices = await prisma.invoice.findMany() // Fetching all for stats? Might be heavy.
        // Let's use what we have or do aggregate
        const aggregates = await prisma.invoice.aggregate({
            _sum: { amountDue: true, amountPaid: true },
            where: {}
        })

        // Let's stick to simple logic for now or improve later
        // Calculating on all invoices for stats is better
        // Calculating on all invoices for stats is better
        const pendingInvoices = await prisma.invoice.findMany({ where: { status: 'SENT' } })
        const paidInvoices = await prisma.invoice.findMany({ where: { status: 'PAID' } })
        const unbilledHours = await prisma.supervisionHour.findMany({ where: { status: 'APPROVED', invoiceId: null } })

        stats.pending = pendingInvoices.reduce((s, i) => s + Number(i.amountDue), 0)
        stats.paid = paidInvoices.reduce((s, i) => s + Number(i.amountPaid), 0)
        stats.total = stats.pending + stats.paid
        const unbilledTotal = unbilledHours.reduce((s, h) => s + Number(h.amountBilled || 0), 0)

    } catch (error) {
        console.error("Error fetching payments:", error)
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Payments</h1>
                        <p className="text-muted-foreground">Manage invoices and track payments</p>
                    </div>
                    <div className="flex gap-2">
                        <GenerateInvoicesButton />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                                <Calendar className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Ready to Invoice</p>
                                <p className="text-2xl font-bold">${unbilledTotal?.toFixed(2) || "0.00"}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                                <Clock className="h-6 w-6 text-warning" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Pending Collection</p>
                                <p className="text-2xl font-bold">${stats.pending.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                                <CheckCircle className="h-6 w-6 text-success" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Collected</p>
                                <p className="text-2xl font-bold">${stats.paid.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex items-center gap-4 p-6">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Billed</p>
                                <p className="text-2xl font-bold">${stats.total.toFixed(2)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Invoices List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Recent Invoices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PaymentsTable invoices={invoices} />
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
