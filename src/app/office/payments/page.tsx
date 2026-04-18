import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, CheckCircle, Clock, TrendingUp, Users, UserCheck } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PaymentsTable } from "@/components/office/payments-table"
import Link from "next/link"
import { SupervisorPaymentsList } from "@/components/office/supervisor-payments-list"
import { StudentInvoicesList } from "@/components/office/student-invoices-list"

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
    let ledgerEntries: any[] = []
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
                student: { 
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        planTemplateId: true,
                        supervisor: true
                    }
                },
                payouts: true,
                supervisionHours: { include: { supervisor: true } }
            }
        })

        // ── SUPERVISOR LEDGER ENTRIES (source of truth for Supervisors tab) ──────
        ledgerEntries = await (prisma as any).supervisorLedgerEntry.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                supervisor: { select: { id: true, fullName: true, email: true, credentialType: true } },
                student:    { select: { id: true, fullName: true } },
                invoice:    { select: { id: true, amountDue: true, status: true, invoiceDate: true } }
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

        const totalPendingToSup = ledgerEntries
            .filter((e: any) => e.payoutStatus === 'PENDING')
            .reduce((s: number, e: any) => s + Number(e.supervisorPayout), 0)

        const totalPaidToSup = ledgerEntries
            .filter((e: any) => e.payoutStatus === 'PAID')
            .reduce((s: number, e: any) => s + Number(e.supervisorPayout), 0)

        stats = {
            readyToGo: readyToGoTotal,
            pending: sentTotal,
            paid: paidTotal,
            owedToSupervisors: totalPendingToSup,
            paidToSupervisors: totalPaidToSup,
        }

    } catch (error) {
        console.error("Error fetching payments:", error)
    }

    // ── GROUP LEDGER ENTRIES BY SUPERVISOR ───────────────────────────────────
    const supervisorSummary: Record<string, {
        name: string
        email: string
        credential: string
        totalPending: number
        totalPaid: number
        entries: any[]
    }> = {}

    for (const entry of ledgerEntries) {
        const supId = entry.supervisorId
        if (!supervisorSummary[supId]) {
            supervisorSummary[supId] = {
                name: entry.supervisor.fullName,
                email: entry.supervisor.email,
                credential: entry.supervisor.credentialType || '',
                totalPending: 0,
                totalPaid: 0,
                entries: []
            }
        }
        const amount = Number(entry.supervisorPayout)
        if (entry.payoutStatus === 'PENDING') {
            supervisorSummary[supId].totalPending += amount
        } else {
            supervisorSummary[supId].totalPaid += amount
        }
        supervisorSummary[supId].entries.push(entry)
    }

    // Scoped search for supervisors tab
    const filteredSupervisorSummary = searchQuery
        ? Object.fromEntries(
            Object.entries(supervisorSummary).filter(([, sup]) =>
                sup.name.toLowerCase().includes(searchQuery) ||
                sup.email.toLowerCase().includes(searchQuery)
            )
          )
        : supervisorSummary

    // Normalize invoices for PaymentsTable (Students tab) — kept for backward compat
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

    // ── GROUP INVOICES BY STUDENT ─────────────────────────────────────────────
    // Fetch plans for all unique students that have a planTemplateId
    const planIds = [...new Set(
        invoices.map((i: any) => i.student.planTemplateId).filter(Boolean)
    )] as string[]

    let plansMap: Record<string, any> = {}
    if (planIds.length > 0) {
        const plans = await prisma.plan.findMany({ where: { id: { in: planIds } } })
        plansMap = Object.fromEntries(plans.map(p => [p.id, p]))
    }

    // Group invoices by student
    const studentGroupsMap: Record<string, {
        studentId: string
        fullName: string
        email: string
        contractTotal: number
        totalBilled: number
        totalPaid: number
        invoices: any[]
    }> = {}

    for (const inv of invoices) {
        const s = inv.student
        if (
            searchQuery &&
            !s.fullName.toLowerCase().includes(searchQuery) &&
            !s.email.toLowerCase().includes(searchQuery)
        ) continue

        if (!studentGroupsMap[s.id]) {
            const plan = plansMap[s.planTemplateId]
            const contractTotal = plan?.totalCost ? Number(plan.totalCost) : 0
            studentGroupsMap[s.id] = {
                studentId: s.id,
                fullName: s.fullName,
                email: s.email,
                contractTotal,
                totalBilled: 0,
                totalPaid: 0,
                invoices: []
            }
        }

        studentGroupsMap[s.id].totalBilled  += Number(inv.amountDue)
        studentGroupsMap[s.id].totalPaid    += Number(inv.amountPaid)
        studentGroupsMap[s.id].invoices.push({
            ...inv,
            amountDue:  Number(inv.amountDue),
            amountPaid: Number(inv.amountPaid),
            student: { id: s.id, fullName: s.fullName, email: s.email }
        })
    }

    const studentGroups = Object.values(studentGroupsMap)


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
                        { label: "Pending to Supervisors", value: stats.owedToSupervisors, icon: UserCheck, color: "text-blue-600", bg: "bg-blue-500/10" },
                        { label: "Paid to Supervisors", value: stats.paidToSupervisors, icon: CheckCircle, color: "text-green-600", bg: "bg-green-500/10" },
                        { label: "Office Net Revenue", value: stats.paid - stats.paidToSupervisors, icon: DollarSign, color: "text-primary", bg: "bg-primary/10" },
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
                    <StudentInvoicesList studentGroups={studentGroups as any} />
                )}

                {/* ── SUPERVISORS TAB ───────────────────────────────────────────── */}
                {activeTab === "supervisors" && (
                    <SupervisorPaymentsList supervisorSummary={filteredSupervisorSummary} />
                )}
            </div>
        </DashboardLayout>
    )
}
