"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"
import { Clock, DollarSign, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Calculator, Info } from "lucide-react"
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
                const isExpanded = expandedSups[supId] !== false // default expanded
                const pendingEntries = sup.entries.filter(e => e.payoutStatus === 'PENDING')
                const paidEntries = sup.entries.filter(e => e.payoutStatus === 'PAID')

                return (
                    <Card key={supId} className="overflow-hidden border-none shadow-md">
                        {/* ── Supervisor Header ── */}
                        <div
                            className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors bg-white border-b"
                            onClick={() => setExpandedSups(p => ({ ...p, [supId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
                                    {sup.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800">{sup.name}</h3>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{sup.credential} · {sup.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-amber-600 font-bold tracking-widest mb-1">Pending</p>
                                    <p className="text-lg font-black text-amber-700 leading-none">{fmtUSD(sup.totalPending)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase text-green-600 font-bold tracking-widest mb-1">Paid</p>
                                    <p className="text-lg font-black text-green-700 leading-none">{fmtUSD(sup.totalPaid)}</p>
                                </div>
                                <div className="h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
                                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="pt-6 px-6 pb-6 space-y-6 bg-slate-50/30">
                                {/* ── PENDING entries ── */}
                                {pendingEntries.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            <p className="text-[10px] uppercase font-black text-amber-600 tracking-[0.2em]">Pending Distributions ({pendingEntries.length})</p>
                                        </div>
                                        <div className="grid gap-2">
                                            {pendingEntries.map(entry => (
                                                <div key={entry.id} className="group flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 group-hover:bg-amber-50 transition-colors">
                                                            <Clock className="h-5 w-5 text-slate-400 group-hover:text-amber-500" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-800">{entry.student.fullName}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono">INV #{entry.invoiceId.slice(-6).toUpperCase()} · {fmtDate(entry.createdAt)}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-8">
                                                        {/* Math Explanation Popover */}
                                                        <div className="text-right">
                                                            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Logic / Share</p>
                                                            <Popover>
                                                                <PopoverTrigger className="flex items-center gap-1.5 font-black text-slate-800 hover:text-primary transition-colors">
                                                                    {fmtUSD(entry.supervisorPayout)} <Calculator className="h-3.5 w-3.5 text-slate-300" />
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-72 p-0 overflow-hidden border-none shadow-2xl" side="left">
                                                                    <div className="bg-slate-900 text-white p-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <Calculator className="h-4 w-4 text-amber-400" />
                                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Calculation Logic</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="p-4 space-y-3 bg-white text-xs">
                                                                        <div>
                                                                            <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Tope Factura (Individual Hours)</p>
                                                                            <p className="font-mono bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                                                                                <span className="text-slate-500">{fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}% =</span>
                                                                                <span className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</span>
                                                                            </p>
                                                                        </div>
                                                                        <div className="pt-2 border-t border-dashed">
                                                                            <div className="flex justify-between font-bold">
                                                                                <span className="text-slate-600">Supervisor Share</span>
                                                                                <span className="text-amber-600">{fmtUSD(entry.supervisorPayout)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>

                                                        <Button
                                                            size="sm"
                                                            className="rounded-xl px-5 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-500/20"
                                                            onClick={() => setSelectedEntry(entry)}
                                                        >
                                                            Pay
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── PAID entries ── */}
                                {paidEntries.length > 0 && (
                                    <div className="space-y-2">
                                         <div className="flex items-center gap-2 px-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                            <p className="text-[10px] uppercase font-black text-green-600 tracking-[0.2em]">Settled Payments ({paidEntries.length})</p>
                                        </div>
                                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b bg-slate-50/50 text-slate-500">
                                                        <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[9px]">Student</th>
                                                        <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[9px]">Date Paid</th>
                                                        <th className="text-right py-3 px-4 font-bold uppercase tracking-tighter text-[9px]">Calculated Split</th>
                                                        <th className="text-right py-3 px-4 font-bold uppercase tracking-tighter text-[9px]">Final Payout</th>
                                                        <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[9px]">Method / Ref</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {paidEntries.map(entry => (
                                                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="py-3 px-4 font-bold text-slate-700">{entry.student.fullName}</td>
                                                            <td className="py-3 px-4 text-slate-500 italic">{fmtDate(entry.paidAt)}</td>
                                                            <td className="py-3 px-4 text-right">
                                                                <Popover>
                                                                    <PopoverTrigger className="text-slate-400 hover:text-slate-600 flex items-center justify-end gap-1 w-full font-mono text-[10px]">
                                                                        Ver Log <Info className="h-3 w-3" />
                                                                    </PopoverTrigger>
                                                                    <PopoverContent className="w-64 p-4 text-xs space-y-2" side="left">
                                                                        <p className="font-bold border-b pb-1">Math Proof</p>
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between text-[10px]">
                                                                                <span>Total Cap (Invoice)</span>
                                                                                <span>{fmtUSD(entry.supervisorCapTotal)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between text-[10px] text-green-600 font-bold border-t pt-1">
                                                                                <span>Final Split</span>
                                                                                <span>{fmtUSD(entry.supervisorPayout)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            </td>
                                                            <td className="py-3 px-4 text-right font-black text-green-700">{fmtUSD(entry.supervisorPayout)}</td>
                                                            <td className="py-3 px-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="text-[8px] font-bold border-slate-300">{entry.paymentMethod || "N/A"}</Badge>
                                                                    <span className="font-mono text-[9px] text-slate-400">{entry.paymentReference || "—"}</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── Financial Summary Box ── */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                    <div className="bg-white border-2 border-green-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <p className="text-[9px] uppercase font-black text-green-600 tracking-widest mb-1">Cleared Earnings</p>
                                        <p className="text-xl font-black text-green-700 leading-none">{fmtUSD(sup.totalPaid)}</p>
                                    </div>
                                    <div className="bg-white border-2 border-amber-100 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <p className="text-[9px] uppercase font-black text-amber-600 tracking-widest mb-1">Floating Payouts</p>
                                        <p className="text-xl font-black text-amber-700 leading-none">{fmtUSD(sup.totalPending)}</p>
                                    </div>
                                    <div className="bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center shadow-lg shadow-slate-900/10">
                                        <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-1">Lifetime Value</p>
                                        <p className="text-xl font-black text-white leading-none">{fmtUSD(sup.totalPaid + sup.totalPending)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                )
            })}

            {selectedEntry && (
                <SupervisorPayoutModal
                    entry={selectedEntry}
                    onClose={() => setSelectedEntry(null)}
                />
            )}
        </div>
    )
}
