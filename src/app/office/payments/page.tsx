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
import { OfficeRevenueList } from "@/components/office/office-revenue-list"
import { Building2 } from "lucide-react"
const fmtUSD = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"

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
    const activeTab = params.tab === "supervisors" ? "supervisors" : params.tab === "office" ? "office" : "students"
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
                supervisor: { select: { id: true, fullName: true, email: true, credentialType: true, paymentPercentage: true } },
                student:    { select: { id: true, fullName: true, planTemplateId: true } },
                invoice:    { 
                    include: { 
                        supervisionHours: { 
                            where: { supervisionType: "INDIVIDUAL" as any }
                        } 
                    } 
                }
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
    
    // ── FETCH PLANS FOR ALL TABS ─────────────────────────────────────────────
    const planIds = [...new Set([
        ...invoices.map((i: any) => i.student.planTemplateId),
        ...ledgerEntries.map((e: any) => e.student.planTemplateId)
    ])].filter(Boolean) as string[]

    let plansMap: Record<string, any> = {}
    if (planIds.length > 0) {
        const plans = await prisma.plan.findMany({ where: { id: { in: planIds } } })
        plansMap = Object.fromEntries(plans.map(p => [p.id, p]))
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
        // Calculate math explanation data (INDIVIDUAL only for supervisor commission)
        // Calculate math explanation data (INDIVIDUAL only for supervisor commission)
        const supervisionHours = entry.invoice.supervisionHours || [];
        
        const individualValue = supervisionHours
            .filter((h: any) => String(h.supervisionType || '').toUpperCase() === 'INDIVIDUAL')
            .reduce((s: number, h: any) => s + Number(h.amountBilled || 0), 0);
            
        const groupValue = supervisionHours
            .filter((h: any) => String(h.supervisionType || '').toUpperCase() === 'GROUP')
            .reduce((s: number, h: any) => s + Number(h.amountBilled || 0), 0);
        
        let effectiveCommission = Number(entry.supervisor.paymentPercentage || 0.54);
        if (entry.student.planTemplateId && plansMap[entry.student.planTemplateId]) {
            const plan = plansMap[entry.student.planTemplateId];
            if (plan.supervisorCommission != null) {
                effectiveCommission = Number(plan.supervisorCommission);
            }
        }

        // Attach to entry (REMOVED Skip so Office tab shows values for ALL entries)
        (entry as any).mathData = {
            individualBilledTotal: individualValue,
            groupBilledTotal: groupValue,
            effectiveCommission,
            formula: `${fmtUSD(individualValue)} × ${(effectiveCommission * 100).toFixed(0)}% = ${fmtUSD(Number(entry.supervisorCapTotal))}`,
            officeIndivNet: Number(entry.officePayout) - groupValue, 
            officeGroupNet: groupValue
        };

        const supId = entry.supervisorId
        const amount = Number(entry.supervisorPayout)

        // Only group for supervisor tab if there is a non-zero payout
        if (amount > 0) {
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
            if (entry.payoutStatus === 'PENDING') {
                supervisorSummary[supId].totalPending += amount
            } else {
                supervisorSummary[supId].totalPaid += amount
            }
            supervisorSummary[supId].entries.push(entry)
        }
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

    // ── OFFICE REVENUE ENTRIES (officePayout > 0) ────────────────────────────
    const officeEntries = ledgerEntries.filter((e: any) => Number(e.officePayout) > 0)
    
    // Scoped search for Office tab
    const filteredOfficeEntries = searchQuery
        ? officeEntries.filter((e: any) => 
            e.student.fullName.toLowerCase().includes(searchQuery) ||
            e.supervisor.fullName.toLowerCase().includes(searchQuery)
          )
        : officeEntries

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
    // Fetch plans for all unique students that have a planTemplateId (already done above)

    // Group invoices by student
    const studentGroupsMap: Record<string, {
        studentId: string
        fullName: string
        email: string
        contractTotal: number
        totalBilled: number
        totalPaid: number
        planName: string
        monthlyPayment: number
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
            const contractTotal  = plan?.totalCost      ? Number(plan.totalCost)      : 0
            const monthlyPayment = plan?.monthlyPayment ? Number(plan.monthlyPayment) : 0
            const planName       = plan?.name           || "No plan assigned"
            studentGroupsMap[s.id] = {
                studentId: s.id,
                fullName: s.fullName,
                email: s.email,
                contractTotal,
                totalBilled: 0,
                totalPaid: 0,
                planName,
                monthlyPayment,
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
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Payments</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Waterfall Settlement Engine</p>
                    </div>
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
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                                    <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground leading-none mb-1">{s.label}</p>
                                    <p className="text-lg font-black text-slate-700 leading-none">{fmtUSD(s.value)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs + Scoped Search */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-0">
                    <div className="flex items-center gap-1">
                        {[
                            { key: "students",    label: "Students",    icon: Users },
                            { key: "supervisors", label: "Supervisors", icon: UserCheck },
                            { key: "office",      label: "Office",      icon: Building2 },
                        ].map(t => (
                            <Link
                                key={t.key}
                                href={`/office/payments?tab=${t.key}`}
                                className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
                                    activeTab === t.key
                                        ? "text-primary bg-violet-50/50"
                                        : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                <t.icon className="h-4 w-4" />
                                {t.label}
                                {activeTab === t.key && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full shadow-[0_-2px_8px_rgba(124,92,252,0.3)]" />
                                )}
                            </Link>
                        ))}
                    </div>

                    <form method="get" action="/office/payments" className="flex items-center gap-2 pb-2">
                        <input type="hidden" name="tab" value={activeTab} />
                        <div className="relative group">
                            <input
                                name="search"
                                defaultValue={searchQuery}
                                placeholder={activeTab === "students" ? "Search students..." : activeTab === "office" ? "Search office..." : "Search supervisors..."}
                                className="h-10 w-64 rounded-full border border-slate-200 bg-slate-50/50 px-5 text-xs font-bold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                            />
                            <div className="absolute right-3 top-2.5 text-slate-300">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
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

                {/* ── OFFICE TAB ────────────────────────────────────────────────── */}
                {activeTab === "office" && (
                    <OfficeRevenueList entries={filteredOfficeEntries} />
                )}
            </div>
        </DashboardLayout>
    )
}
