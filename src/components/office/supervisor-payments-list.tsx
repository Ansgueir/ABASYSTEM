"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"
import { Clock, DollarSign, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"

interface LedgerEntry {
    id: string
    invoiceId: string
    supervisorId: string
    studentId: string
    paymentFromStudent: number
    supervisorCapTotal: number
    supervisorCapRemainingBefore: number
    supervisorPayout: number
    officePayout: number
    supervisorCapRemainingAfter: number
    planMonthlyPayment: number | null
    planHoursPerMonth: number | null
    planSupervisedHours: number | null
    planIndividualHours: number | null
    planIndividualSupervisedTarget: number | null
    planGroupSupervisionTarget: number | null
    planIndividualSupervisedDelta: number | null
    planGroupSupervisionDelta: number | null
    payoutStatus: string
    supervisedHoursActual: number | null
    individualHoursDelta: number | null
    paymentMethod: string | null
    paymentReference: string | null
    paymentNotes: string | null
    paidAt: string | null
    createdAt: string
    student: { id: string; fullName: string }
    invoice: { id: string; amountDue: number; status: string; invoiceDate: string }
}

interface SupervisorGroup {
    name: string
    email: string
    credential: string
    totalPending: number
    totalPaid: number
    entries: LedgerEntry[]
}

interface SupervisorPaymentsListProps {
    supervisorSummary: Record<string, SupervisorGroup>
}

const fmtUSD = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "—"

export function SupervisorPaymentsList({ supervisorSummary }: SupervisorPaymentsListProps) {
    const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null)
    const [expandedSups, setExpandedSups] = useState<Record<string, boolean>>({})

    const entries = Object.entries(supervisorSummary)

    if (entries.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No supervisor payment entries found.</p>
                    <p className="text-sm mt-1">They appear here when a student payment is registered.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {entries.map(([supId, sup]) => {
                const isExpanded = expandedSups[supId] !== false // default expanded
                const pendingEntries = sup.entries.filter(e => e.payoutStatus === 'PENDING')
                const paidEntries = sup.entries.filter(e => e.payoutStatus === 'PAID')

                return (
                    <Card key={supId} className="overflow-hidden">
                        {/* ── Supervisor Header ── */}
                        <div
                            className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedSups(p => ({ ...p, [supId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                                    {sup.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">{sup.name}</h3>
                                    <p className="text-xs text-muted-foreground">{sup.credential} · {sup.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-amber-600 font-bold">Pending</p>
                                    <p className="text-base font-black text-amber-700">{fmtUSD(sup.totalPending)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-green-600 font-bold">Paid</p>
                                    <p className="text-base font-black text-green-700">{fmtUSD(sup.totalPaid)}</p>
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="pt-0 px-4 pb-4 space-y-3">
                                {/* ── PENDING entries ── */}
                                {pendingEntries.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-amber-600 mb-2 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Pending Payment ({pendingEntries.length})
                                        </p>
                                        <div className="space-y-2">
                                            {pendingEntries.map(entry => (
                                                <div key={entry.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <p className="text-xs font-bold">{entry.student.fullName}</p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                Invoice #{entry.invoiceId.slice(-6).toUpperCase()} · {fmtDate(entry.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-right">
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground">Student Paid</p>
                                                            <p className="text-xs font-bold text-blue-700">{fmtUSD(entry.paymentFromStudent)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground">Sup. Share</p>
                                                            <p className="text-xs font-bold text-slate-800">{fmtUSD(entry.supervisorPayout)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-muted-foreground">Remanente</p>
                                                            <p className="text-xs font-bold text-emerald-700">{fmtUSD(entry.supervisorCapRemainingAfter)}</p>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            className="h-7 px-3 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                                            onClick={() => setSelectedEntry(entry)}
                                                        >
                                                            Pay Supervisor
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── PAID entries ── */}
                                {paidEntries.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-green-600 mb-2 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Payment History ({paidEntries.length})
                                        </p>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b text-muted-foreground">
                                                        <th className="text-left pb-1.5 font-medium">Student</th>
                                                        <th className="text-left pb-1.5 font-medium">Date Paid</th>
                                                        <th className="text-right pb-1.5 font-medium">Amount</th>
                                                        <th className="text-right pb-1.5 font-medium">Sup Hrs</th>
                                                        <th className="text-left pb-1.5 font-medium">Method</th>
                                                        <th className="text-left pb-1.5 font-medium">Reference</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paidEntries.map(entry => (
                                                        <tr key={entry.id} className="border-b border-muted/40 hover:bg-muted/10">
                                                            <td className="py-1.5">{entry.student.fullName}</td>
                                                            <td className="py-1.5 text-muted-foreground">{fmtDate(entry.paidAt)}</td>
                                                            <td className="py-1.5 text-right font-bold text-green-700">{fmtUSD(entry.supervisorPayout)}</td>
                                                            <td className="py-1.5 text-right">{entry.supervisedHoursActual != null ? `${Number(entry.supervisedHoursActual).toFixed(1)}h` : "—"}</td>
                                                            <td className="py-1.5">
                                                                {entry.paymentMethod
                                                                    ? <Badge variant="outline" className="text-[9px]">{entry.paymentMethod}</Badge>
                                                                    : "—"}
                                                            </td>
                                                            <td className="py-1.5 text-muted-foreground font-mono text-[10px]">{entry.paymentReference || "—"}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {sup.entries.length === 0 && (
                                    <p className="text-xs text-center text-muted-foreground py-4">No entries yet for this supervisor.</p>
                                )}
                            </CardContent>
                        )}
                    </Card>
                )
            })}

            {/* ── Payout Modal ── */}
            {selectedEntry && (
                <SupervisorPayoutModal
                    isOpen={!!selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                    entry={selectedEntry}
                />
            )}
        </div>
    )
}
