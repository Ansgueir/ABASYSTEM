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
    searchParams: Promise<{ tab?: string; search?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const officeRole = (session.user as any).officeRole
    if (officeRole !== "SUPER_ADMIN") redirect("/office")

    const params = await searchParams
    const activeTab = params.tab === "supervisors" ? "supervisors" : "students"
    const searchQuery = (params.search || "").toLowerCase().trim()

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
            where: {
                status: { in: ["READY_TO_GO", "SENT", "PAID"] } as any
            },
            orderBy: { createdAt: 'desc' },
            include: {
                student: { include: { supervisor: true } }
            }
        })

        // ── SUPERVISOR LEDGER DATA ───────────────────────────────────────────────
        supervisorLedger = await (prisma as any).supervisorLedgerEntry.findMany({
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
            .filter(i => i.status === 'SENT')
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
    // ── SUPERVISOR PROJECTION LOGIC — FIX #1 & #2 ───────────────────────────
    const supervisorSummary: Record<string, {
        name: string
        credential: string
        totalProjected: number
        totalPaid: number
        invoices: any[]
    }> = {}

    // We iterate over ALL invoices to create the mirror view for supervisors
    for (const inv of invoices) {
        // High-level: find the supervisor(s) involved in this invoice
        // For simplicity in this view, we use the student's primary supervisor and their percentage
        const supervisor = inv.student.supervisor
        if (supervisor && inv.student.supervisorId) {
            const id = inv.student.supervisorId
            const payPercent = Number(supervisor.paymentPercentage || 0.54)
            const capTotal = Number(inv.amountDue) * payPercent
            const paidToSup = supervisorLedger
                .filter(e => e.invoiceId === inv.id && e.supervisorId === id)
                .reduce((s, e) => s + Number(e.supervisorPayout), 0)

            if (!supervisorSummary[id]) {
                supervisorSummary[id] = {
                    name: supervisor.fullName,
                    credential: supervisor.credentialType,
                    totalProjected: 0,
                    totalPaid: 0,
                    invoices: []
                }
            }

            supervisorSummary[id].totalProjected += capTotal
            supervisorSummary[id].totalPaid += paidToSup
            
            // Add this invoice to the supervisor's list
            supervisorSummary[id].invoices.push({
                id: inv.id,
                studentName: inv.student.fullName,
                date: inv.invoiceDate,
                status: inv.status,
                invoiceTotal: Number(inv.amountDue),
                supervisorCap: capTotal,
                paidAmount: paidToSup,
                remainingCap: capTotal - paidToSup
            })
        }
    }

    // FIX #3: Scoped search for supervisors mapping
    const filteredSupervisorSummary = searchQuery
        ? Object.fromEntries(
            Object.entries(supervisorSummary).filter(([, sup]) =>
                sup.name.toLowerCase().includes(searchQuery)
            )
          )
        : supervisorSummary

    // Normalize invoices for PaymentsTable
    const normalizedInvoices = invoices
        .map(inv => ({
            ...inv,
            amountDue:  Number(inv.amountDue),
            amountPaid: Number(inv.amountPaid),
            student: { fullName: inv.student.fullName, email: inv.student.email }
        }))
        .filter(inv =>
            !searchQuery ||
            inv.student.fullName.toLowerCase().includes(searchQuery) ||
            inv.student.email.toLowerCase().includes(searchQuery)
        )

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
                        { label: "Owed to Supervisors", value: Object.values(supervisorSummary).reduce((s, sup) => s + (sup.totalProjected - sup.totalPaid), 0), icon: UserCheck, color: "text-blue-600", bg: "bg-blue-500/10" },
                        { label: "Office Revenue",   value: stats.paid - Object.values(supervisorSummary).reduce((s, sup) => s + sup.totalPaid, 0), icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
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

                {/* Tabs + Scoped Search — FIX #3 */}
                <div className="flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-1">
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
                    {/* Scoped search - URL driven so it only affects active tab */}
                    <form method="get" action="/office/payments" className="flex items-center gap-2 pb-1">
                        <input type="hidden" name="tab" value={activeTab} />
                        <input
                            name="search"
                            defaultValue={searchQuery}
                            placeholder={activeTab === "students" ? "Search students..." : "Search supervisors..."}
                            className="h-8 w-52 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </form>
                </div>

                {/* ── STUDENTS TAB ─────────────────────────────────────────────────── */}
                {activeTab === "students" && (
                    <Card>
                        <CardContent className="pt-4 px-0 pb-0">
                            <PaymentsTable invoices={normalizedInvoices as any} />
                        </CardContent>
                    </Card>
                )}

                {/* ── SUPERVISORS TAB — FIX #1, #2, #3 ──────────────────────────── */}
                {activeTab === "supervisors" && (
                    <div className="space-y-4">
                        {Object.keys(filteredSupervisorSummary).length === 0 ? (
                            <Card>
                                <CardContent className="py-16 text-center text-muted-foreground">
                                    {searchQuery ? `No supervisors matching "${searchQuery}"` : "No active invoices for supervisors found."}
                                </CardContent>
                            </Card>
                        ) : Object.entries(filteredSupervisorSummary).map(([supId, sup]) => (
                            <Card key={supId}>
                                <CardContent className="pt-5">
                                    {/* Supervisor Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-base">{sup.name}</h3>
                                            <p className="text-xs text-muted-foreground">{sup.credential}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-muted-foreground">Projected Total for Active Invoices</p>
                                            <p className="text-xl font-bold text-primary">${sup.totalProjected.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {/* Invoices Mirror List for Supervisor */}
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b text-muted-foreground">
                                                    <th className="text-left pb-2 font-medium">Invoice</th>
                                                    <th className="text-left pb-2 font-medium">Student</th>
                                                    <th className="text-left pb-2 font-medium">Status</th>
                                                    <th className="text-right pb-2 font-medium">Bill Total</th>
                                                    <th className="text-right pb-2 font-medium text-primary">Your Cap (%)</th>
                                                    <th className="text-right pb-2 font-medium text-green-600">Paid to You</th>
                                                    <th className="text-right pb-2 font-medium text-amber-600">Rem. Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sup.invoices.map((inv: any) => (
                                                    <tr key={inv.id} className="border-b border-muted/50 hover:bg-muted/20">
                                                        <td className="py-2 font-mono text-[10px]">#{inv.id.slice(-6).toUpperCase()}</td>
                                                        <td className="py-2">{inv.studentName}</td>
                                                        <td className="py-2">
                                                            <span className="text-[10px] uppercase font-bold border px-1.5 py-0.5 rounded-md">
                                                                {inv.status.replace(/_/g, ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="py-2 text-right">${inv.invoiceTotal.toFixed(2)}</td>
                                                        <td className="py-2 text-right font-medium text-primary">${inv.supervisorCap.toFixed(2)}</td>
                                                        <td className="py-2 text-right font-bold text-green-600">${inv.paidAmount.toFixed(2)}</td>
                                                        <td className="py-2 text-right font-bold text-amber-600">${inv.remainingCap.toFixed(2)}</td>
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
