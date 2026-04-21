"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"
import { Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calculator, Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
    payoutStatus: string
    supervisedHoursActual: number | null
    individualHoursDelta: number | null
    paymentMethod: string | null
    paymentReference: string | null
    paymentNotes: string | null
    paidAt: string | null
    createdAt: string
    
    // Plan Snapshot fields
    planMonthlyPayment: number | null
    planHoursPerMonth: number | null
    planSupervisedHours: number | null
    planIndividualHours: number | null
    planIndividualSupervisedTarget: number | null
    planGroupSupervisionTarget: number | null
    planIndividualSupervisedDelta: number | null
    planGroupSupervisionDelta: number | null
    
    student: { id: string; fullName: string }
    invoice: { id: string; amountDue: number; status: string; invoiceDate: string }
    
    // Enriched math data from page.tsx
    mathData?: {
        individualBilledTotal: number
        effectiveCommission: number
        formula: string
    }
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
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {entries.map(([supId, sup]) => {
                const isExpanded = expandedSups[supId] !== false
                const pendingEntries = sup.entries.filter(e => e.payoutStatus === 'PENDING')
                const paidEntries = sup.entries.filter(e => e.payoutStatus === 'PAID')

                return (
                    <Card key={supId} className="overflow-hidden border border-border shadow-sm">
                        {/* ── Supervisor Header ── */}
                        <div
                            className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors bg-white border-b border-border"
                            onClick={() => setExpandedSups(p => ({ ...p, [supId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                                    {sup.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base">{sup.name}</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">
                                        {sup.credential} · {sup.email}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right border-r pr-4 border-border">
                                    <p className="text-[9px] uppercase text-amber-600 font-bold tracking-widest">Pending</p>
                                    <p className="text-base font-black text-amber-600">{fmtUSD(sup.totalPending)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] uppercase text-green-600 font-bold tracking-widest">Paid</p>
                                    <p className="text-base font-black text-green-600">{fmtUSD(sup.totalPaid)}</p>
                                </div>
                                <div className="ml-2">
                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="pt-6 px-6 pb-6 space-y-6">
                                {/* ── PENDING entries ── */}
                                {pendingEntries.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-1.5 rounded-full bg-amber-500" />
                                            <p className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Payments to Settle ({pendingEntries.length})</p>
                                        </div>
                                        <div className="grid gap-2">
                                            {pendingEntries.map(entry => (
                                                <div key={entry.id} className="flex items-center justify-between bg-amber-50/40 border border-amber-100 rounded-xl p-4 transition-all hover:bg-amber-50">
                                                    <div className="flex items-center gap-4">
                                                        <Clock className="h-4 w-4 text-amber-500 opacity-60" />
                                                        <div>
                                                            <p className="text-xs font-bold">{entry.student.fullName}</p>
                                                            <p className="text-[10px] text-muted-foreground">Invoice #{entry.invoiceId.slice(-6).toUpperCase()} · {fmtDate(entry.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-8">
                                                        {/* Math Explanation Popover */}
                                                        <div className="text-right">
                                                            <p className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Calculated Share</p>
                                                            <Popover>
                                                                <PopoverTrigger className="flex items-center justify-end gap-1 font-black text-slate-800 hover:text-primary transition-colors text-xs">
                                                                    {fmtUSD(entry.supervisorPayout)} <Calculator className="h-3 w-3 opacity-40" />
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-72 p-4 shadow-xl border-border" side="top">
                                                                    <div className="space-y-3">
                                                                        <div className="flex items-center gap-2 border-b pb-2">
                                                                            <Calculator className="h-4 w-4 text-primary" />
                                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Calculation Logic</p>
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <div>
                                                                                <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Total Cap (Invoice Indiv Hours)</p>
                                                                                <p className="text-xs font-mono bg-muted p-2 rounded flex justify-between">
                                                                                    <span className="text-muted-foreground">{fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}% =</span>
                                                                                    <span className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</span>
                                                                                </p>
                                                                            </div>
                                                                            <div className="pt-2 border-t border-dashed">
                                                                                <div className="flex justify-between font-bold text-xs">
                                                                                    <span className="text-muted-foreground">Supervisor Share</span>
                                                                                    <span className="text-amber-600">{fmtUSD(entry.supervisorPayout)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            className="rounded-lg px-4 bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
                                                            onClick={() => setSelectedEntry(entry)}
                                                        >
                                                            Pay Dist.
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── PAID entries (Clean Table) ── */}
                                {paidEntries.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <div className="h-3 w-1.5 rounded-full bg-green-500" />
                                            <p className="text-[10px] uppercase font-bold text-green-600 tracking-wider">Settled Distributions ({paidEntries.length})</p>
                                        </div>
                                        <div className="bg-white rounded-xl border border-border overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b bg-muted/30 text-muted-foreground">
                                                        <th className="text-left py-2.5 px-4 font-bold uppercase tracking-tighter text-[9px]">Student</th>
                                                        <th className="text-left py-2.5 px-4 font-bold uppercase tracking-tighter text-[9px]">Date Paid</th>
                                                        <th className="text-right py-2.5 px-4 font-bold uppercase tracking-tighter text-[9px]">Proof</th>
                                                        <th className="text-right py-2.5 px-4 font-bold uppercase tracking-tighter text-[9px]">Final Payout</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {paidEntries.map(entry => (
                                                        <tr key={entry.id} className="hover:bg-muted/20">
                                                            <td className="py-2.5 px-4 font-bold">{entry.student.fullName}</td>
                                                            <td className="py-2.5 px-4 text-muted-foreground italic">{fmtDate(entry.paidAt)}</td>
                                                            <td className="py-2.5 px-4 text-right">
                                                                <Popover>
                                                                    <PopoverTrigger className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
                                                                        <Info className="h-3 w-3" /> <span className="text-[9px] uppercase font-bold">Logic</span>
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64 p-3 text-xs" side="left">
                                                                        <p className="font-bold border-b pb-1 text-primary text-[10px] uppercase tracking-widest mb-2">Math Proof</p>
                                                                        <div className="space-y-1 text-[10px]">
                                                                            <div className="flex justify-between">
                                                                                <span>Total Cap (Invoice)</span>
                                                                                <span className="font-mono">{fmtUSD(entry.supervisorCapTotal)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-green-600 font-bold border-t pt-1 mt-1">
                                                                                <span>Final Split</span>
                                                                                <span>{fmtUSD(entry.supervisorPayout)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </td>
                                                            <td className="py-2.5 px-4 text-right font-black text-green-700">{fmtUSD(entry.supervisorPayout)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── FINAL SUMMARY BLOCK (Match Student Tab Maravillosa style) ── */}
                                <div className="space-y-3 pt-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest text-center">Cumulative Supervisor Earnings</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        <div className="flex flex-col items-center justify-center bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                                            <p className="text-[9px] uppercase text-green-700 font-bold tracking-wider">Cleared</p>
                                            <p className="text-lg font-black text-green-700 leading-tight">{fmtUSD(sup.totalPaid)}</p>
                                            <p className="text-[9px] text-green-600/70 mt-0.5">received by super</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                                            <p className="text-[9px] uppercase text-amber-700 font-bold tracking-wider">Pending</p>
                                            <p className="text-lg font-black text-amber-700 leading-tight">{fmtUSD(sup.totalPending)}</p>
                                            <p className="text-[9px] text-amber-600/70 mt-0.5">floating payouts</p>
                                        </div>
                                        <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl p-3 border border-primary/20 text-center sm:col-span-1 col-span-2">
                                            <p className="text-[9px] uppercase text-primary font-bold tracking-wider">Lifetime</p>
                                            <p className="text-lg font-black text-primary leading-tight">{fmtUSD(sup.totalPaid + sup.totalPending)}</p>
                                            <p className="text-[9px] text-primary/70 mt-0.5">total allocated</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-center text-muted-foreground pt-1">
                                        <span className="text-green-700 font-semibold">{fmtUSD(sup.totalPaid)}</span> cleared + <span className="text-amber-700 font-semibold">{fmtUSD(sup.totalPending)}</span> pending = <span className="font-bold text-primary">{fmtUSD(sup.totalPaid + sup.totalPending)}</span> allocated to this supervisor.
                                    </p>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )
            })}

            {selectedEntry && (
                <SupervisorPayoutModal
                    isOpen={!!selectedEntry}
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    )
}
