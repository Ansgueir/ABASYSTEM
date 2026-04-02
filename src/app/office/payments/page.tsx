import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, CheckCircle, Clock, TrendingUp, Users, UserCheck } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { PaymentsTable } from "@/components/office/payments-table"
import Link from "next/link"

export default async function OfficePaymentsPage({
    searchParams
}: {
    searchParams: Promise<{ tab?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const officeRole = (session.user as any).officeRole
    if (officeRole !== "SUPER_ADMIN") redirect("/office")

    const params = await searchParams
    const activeTab = params.tab === "supervisors" ? "supervisors" : "students"

    let invoices: any[] = []
    let supervisorLedger: any[] = []
    let stats = {
        readyToGo: 0,
        pending: 0,
        paid: 0,
        owedToSupervisors: 0,
        paidToSupervisors: 0,
    }

    try {
        // ── STUDENT TAB DATA ─────────────────────────────────────────────────────
        invoices = await prisma.invoice.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                student: { select: { fullName: true, email: true } },
                supervisionHours: {
                    include: { supervisor: { select: { fullName: true } } }
                }
            }
        })

        // ── SUPERVISOR LEDGER DATA ───────────────────────────────────────────────
        supervisorLedger = await prisma.supervisorLedgerEntry.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                supervisor: { select: { fullName: true, email: true, credentialType: true } },
                student:    { select: { fullName: true } },
                invoice:    { select: { amountDue: true, status: true } }
            }
        })

        // ── STATS ────────────────────────────────────────────────────────────────
        const readyToGoTotal = invoices
            .filter(i => i.status === 'READY_TO_GO')
            .reduce((s, i) => s + Number(i.amountDue), 0)

        const sentTotal = invoices
            .filter(i => i.status === 'SENT' || i.status === 'PARTIAL')
            .reduce((s, i) => s + Number(i.amountDue) - Number(i.amountPaid), 0)

        const paidTotal = invoices
            .filter(i => i.status === 'PAID')
            .reduce((s, i) => s + Number(i.amountPaid), 0)

        const totalOwedToSup = supervisorLedger.reduce((s, e) => s + Number(e.supervisorPayout), 0)

        stats = {
            readyToGo: readyToGoTotal,
            pending: sentTotal,
            paid: paidTotal,
            owedToSupervisors: totalOwedToSup,
            paidToSupervisors: totalOwedToSup, // All recorded entries are "paid" in ledger
        }

    } catch (error) {
        console.error("Error fetching payments:", error)
    }

    // ── GROUP LEDGER BY SUPERVISOR FOR DISPLAY ───────────────────────────────
    const supervisorSummary: Record<string, {
        name: string
        credential: string
        totalEarned: number
        entries: any[]
    }> = {}

    for (const entry of supervisorLedger) {
        const id = entry.supervisorId
        if (!supervisorSummary[id]) {
            supervisorSummary[id] = {
                name: entry.supervisor.fullName,
                credential: entry.supervisor.credentialType,
                totalEarned: 0,
                entries: []
            }
        }
        supervisorSummary[id].totalEarned += Number(entry.supervisorPayout)
        supervisorSummary[id].entries.push(entry)
    }

    // Normalize invoices for PaymentsTable
    const normalizedInvoices = invoices.map(inv => ({
        ...inv,
        amountDue:  Number(inv.amountDue),
        amountPaid: Number(inv.amountPaid),
        student: {
            fullName: inv.student.fullName,
            email: inv.student.email
        }
    }))

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold">Payments</h1>
                    <p className="text-muted-foreground">Waterfall payout engine — manage invoices and supervisor distributions</p>
                </div>

                {/* Stats */}
                <div className="grid gap-4 md:grid-cols-5">
                    {[
                        { label: "Ready to Invoice", value: stats.readyToGo, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
                        { label: "Pending Payment", value: stats.pending,    icon: Clock,      color: "text-amber-600",   bg: "bg-amber-500/10" },
                        { label: "Collected",        value: stats.paid,      icon: CheckCircle, color: "text-green-600",  bg: "bg-green-500/10" },
                        { label: "Paid to Supervisors", value: stats.paidToSupervisors, icon: UserCheck, color: "text-blue-600", bg: "bg-blue-500/10" },
                        { label: "Office Revenue",   value: stats.paid - stats.paidToSupervisors, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
                    ].map(s => (
                        <Card key={s.label}>
                            <CardContent className="flex items-center gap-3 p-5">
                                <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                                    <s.icon className={`h-5 w-5 ${s.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-xl font-bold">${s.value.toFixed(2)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-border">
                    {[
                        { key: "students",    label: "Students",    icon: Users },
                        { key: "supervisors", label: "Supervisors", icon: UserCheck },
                    ].map(t => (
                        <Link
                            key={t.key}
                            href={`/office/payments?tab=${t.key}`}
                            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === t.key
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <t.icon className="h-4 w-4" /> {t.label}
                        </Link>
                    ))}
                </div>

                {/* ── STUDENTS TAB ─────────────────────────────────────────────────── */}
                {activeTab === "students" && (
                    <Card>
                        <CardContent className="pt-4 px-0 pb-0">
                            <PaymentsTable invoices={normalizedInvoices as any} />
                        </CardContent>
                    </Card>
                )}

                {/* ── SUPERVISORS TAB ──────────────────────────────────────────────── */}
                {activeTab === "supervisors" && (
                    <div className="space-y-4">
                        {Object.keys(supervisorSummary).length === 0 ? (
                            <Card>
                                <CardContent className="py-16 text-center text-muted-foreground">
                                    No supervisor payments recorded yet. Payments are registered automatically when a student invoice is processed.
                                </CardContent>
                            </Card>
                        ) : Object.entries(supervisorSummary).map(([supId, sup]) => (
                            <Card key={supId}>
                                <CardContent className="pt-5">
                                    {/* Supervisor Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-base">{sup.name}</h3>
                                            <p className="text-xs text-muted-foreground">{sup.credential}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Total Earned (Ledger)</p>
                                            <p className="text-xl font-bold text-green-600">${sup.totalEarned.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {/* Ledger Entries */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b text-muted-foreground">
                                                    <th className="text-left pb-2 font-medium">Date</th>
                                                    <th className="text-left pb-2 font-medium">Student</th>
                                                    <th className="text-right pb-2 font-medium">Student Paid</th>
                                                    <th className="text-right pb-2 font-medium">Cap Total</th>
                                                    <th className="text-right pb-2 font-medium">Rem. Before</th>
                                                    <th className="text-right pb-2 font-medium text-green-600">Sup. Payout</th>
                                                    <th className="text-right pb-2 font-medium">Office Payout</th>
                                                    <th className="text-right pb-2 font-medium">Rem. After</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sup.entries.map((e: any) => (
                                                    <tr key={e.id} className="border-b border-muted/50 hover:bg-muted/20">
                                                        <td className="py-2">{format(new Date(e.createdAt), 'MMM d, yyyy')}</td>
                                                        <td className="py-2">{e.student.fullName}</td>
                                                        <td className="py-2 text-right">${Number(e.paymentFromStudent).toFixed(2)}</td>
                                                        <td className="py-2 text-right">${Number(e.supervisorCapTotal).toFixed(2)}</td>
                                                        <td className="py-2 text-right">${Number(e.supervisorCapRemainingBefore).toFixed(2)}</td>
                                                        <td className="py-2 text-right font-bold text-green-600">${Number(e.supervisorPayout).toFixed(2)}</td>
                                                        <td className="py-2 text-right">${Number(e.officePayout).toFixed(2)}</td>
                                                        <td className={`py-2 text-right font-medium ${Number(e.supervisorCapRemainingAfter) === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                                                            ${Number(e.supervisorCapRemainingAfter).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
