"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"
import { Clock, Calculator, Eye, ChevronDown, ChevronUp, CheckCircle, Info } from "lucide-react"
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
    
    // Enriched math data from page.tsx (MUST BE USED FOR EXPLICIT MATH)
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
            <Card className="border-none shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                    <p className="font-medium">No supervisor payment entries found.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4 font-sans">
            {entries.map(([supId, sup]) => {
                const isExpanded = expandedSups[supId] !== false
                const pendingEntries = sup.entries.filter(e => e.payoutStatus === 'PENDING')
                const paidEntries = sup.entries.filter(e => e.payoutStatus === 'PAID')
                const totalAllocated = sup.totalPaid + sup.totalPending

                return (
                    <Card key={supId} className="overflow-hidden border border-border shadow-sm rounded-xl bg-white transition-all duration-200">
                        {/* ── HEADER ── */}
                        <div
                            className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/20"
                            onClick={() => setExpandedSups(p => ({ ...p, [supId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                                    {sup.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-tight text-slate-800">{sup.name}</h3>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                        <p className="text-xs text-muted-foreground">{sup.email}</p>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-none px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase">
                                            {sup.credential}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-5">
                                <div className="hidden sm:flex items-center gap-4 text-right">
                                    <div>
                                        <p className="text-[10px] uppercase text-green-600 font-bold">PAID</p>
                                        <p className="text-sm font-black text-green-700">{fmtUSD(sup.totalPaid)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-amber-600 font-bold">PENDING</p>
                                        <p className="text-sm font-black text-amber-700">{fmtUSD(sup.totalPending)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-indigo-600 font-bold">LIFETIME</p>
                                        <p className="text-sm font-black text-indigo-700">{fmtUSD(totalAllocated)}</p>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="px-4 pb-4 pt-0 space-y-4">
                                {/* ── Pending Distributions (Explicit Logic Included) ── */}
                                {pendingInvoicesSection(pendingEntries, setSelectedEntry)}

                                {/* ── Settled Distributions (Explicit Logic Re-added) ── */}
                                {settledInvoicesSection(paidEntries)}

                                {/* ── Financial Summary ── */}
                                <div className="rounded-xl border border-border bg-slate-50/80 p-4 space-y-3">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">FINANCIAL RECONCILIATION</p>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        <div className="flex flex-col items-center justify-center bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                                            <p className="text-[9px] uppercase text-green-700 font-bold tracking-wider">Cleared</p>
                                            <p className="text-lg font-black text-green-700 leading-tight">{fmtUSD(sup.totalPaid)}</p>
                                            <p className="text-[9px] text-green-600/70 mt-0.5 uppercase font-bold tracking-tight">payouts settled</p>
                                        </div>
                                        
                                        <div className="flex flex-col items-center justify-center bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                                            <p className="text-[9px] uppercase text-amber-700 font-bold tracking-wider">Pending</p>
                                            <p className="text-lg font-black text-amber-700 leading-tight">{fmtUSD(sup.totalPending)}</p>
                                            <p className="text-[9px] text-amber-600/70 mt-0.5 uppercase font-bold tracking-tight">accrued balance</p>
                                        </div>
                                        
                                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200 text-center">
                                            <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider">Lifetime Total</p>
                                            <p className="text-lg font-black text-slate-700 leading-tight">{fmtUSD(totalAllocated)}</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5 uppercase font-bold tracking-tight">cumulative earnings</p>
                                        </div>
                                    </div>

                                    {/* Equation Text */}
                                    <p className="text-[10px] text-center text-muted-foreground pt-1">
                                        <span className="text-green-700 font-semibold">{fmtUSD(sup.totalPaid)}</span> paid + <span className="text-amber-700 font-semibold">{fmtUSD(sup.totalPending)}</span> balance = <span className="font-bold text-slate-700">{fmtUSD(totalAllocated)}</span> plan total
                                    </p>

                                    {/* Progress Bar */}
                                    {totalAllocated > 0 && (
                                        <div>
                                            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                                                <span className="text-green-700 font-semibold">{((sup.totalPaid / totalAllocated) * 100).toFixed(1)}% paid</span>
                                                <span className="text-amber-700 font-semibold">{((sup.totalPending / totalAllocated) * 100).toFixed(1)}% remaining</span>
                                            </div>
                                            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000"
                                                    style={{ width: `${(sup.totalPaid / totalAllocated) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
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

function pendingInvoicesSection(entries: LedgerEntry[], setSelected: any) {
    if (entries.length === 0) return null
    return (
        <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pending / Active ({entries.length})
            </p>
            {entries.map(entry => (
                <div key={entry.id} className="group flex items-center justify-between border border-border rounded-xl p-3 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col min-w-[70px]">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">#{entry.invoiceId.slice(-6).toUpperCase()}</span>
                            <span className="text-xs font-bold text-slate-700">{fmtDate(entry.createdAt)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] uppercase font-black text-slate-300 tracking-widest leading-none mb-1">Student</span>
                            <span className="text-xs font-bold text-slate-700">{entry.student.fullName}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="text-right pl-4">
                            <p className="text-[9px] text-primary uppercase font-black tracking-widest leading-none mb-1">Supervisor Share</p>
                            <p className="text-sm font-black text-green-700 leading-none">{fmtUSD(entry.supervisorPayout)}</p>
                        </div>
                        
                        <div className="flex items-center gap-2 pl-4 border-l border-slate-100">
                            
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-[10px] font-bold border-slate-200 hover:bg-primary hover:text-white transition-all uppercase rounded-lg shadow-sm"
                                onClick={(e) => { e.stopPropagation(); setSelected(entry);}}
                            >
                                Pay Now
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function settledInvoicesSection(entries: LedgerEntry[]) {
    if (entries.length === 0) return null
    return (
        <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Payment History ({entries.length})
            </p>
            <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-[11px]">
                    <thead>
                        <tr className="border-b bg-muted/40 text-muted-foreground">
                            <th className="text-left py-2 px-4 font-bold uppercase text-[9px]">Student</th>
                            <th className="text-left py-2 px-4 font-bold uppercase text-[9px]">Settled Date</th>
                            <th className="text-right py-2 px-4 font-bold uppercase text-[9px]">Final Payout</th>
                            <th className="text-left py-2 px-4 font-bold uppercase text-[9px]">Method</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/40">
                        {entries.map(entry => (
                            <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                                <td className="py-2.5 px-4 font-extrabold text-slate-700">{entry.student.fullName}</td>
                                <td className="py-2.5 px-4 text-slate-400 font-medium">{fmtDate(entry.paidAt || entry.createdAt)}</td>
                                <td className="py-2.5 px-4 text-right font-black text-green-700 text-sm">{fmtUSD(entry.supervisorPayout)}</td>
                                <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[8px] font-bold border-slate-200 py-0 h-4 uppercase">{entry.paymentMethod || "ZELLE"}</Badge>
                                        <span className="font-mono text-[9px] text-slate-300 truncate max-w-[60px] tracking-tighter">#{entry.paymentReference?.slice(-4) || "—"}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
