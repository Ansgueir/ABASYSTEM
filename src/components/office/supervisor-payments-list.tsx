"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import React, { useState } from "react"
import { SupervisorPayoutModal } from "./supervisor-payout-modal"
import { Clock, Calculator, Info, FileText, Eye, ChevronDown, ChevronUp } from "lucide-react"
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
            <Card className="border-none shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
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
                const totalAllocated = sup.totalPaid + sup.totalPending

                return (
                    <Card key={supId} className="overflow-hidden border border-border shadow-sm rounded-3xl bg-white">
                        {/* ── HEADER (Student Style) ── */}
                        <div
                            className="flex items-center justify-between p-6 cursor-pointer"
                            onClick={() => setExpandedSups(p => ({ ...p, [supId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-full bg-violet-100 flex items-center justify-center font-bold text-primary text-lg">
                                    {sup.name.charAt(0)}
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className="font-bold text-xl text-slate-800">{sup.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm text-slate-400">{sup.email}</p>
                                        <Badge variant="secondary" className="bg-violet-50 text-primary hover:bg-violet-50 border-none px-2.5 py-0.5 text-[11px] font-semibold rounded-full uppercase">
                                            {sup.credential}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-green-600 mb-1">PAID</p>
                                    <p className="text-xl font-bold text-slate-700">{fmtUSD(sup.totalPaid)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-amber-600 mb-1">PENDING</p>
                                    <p className="text-xl font-bold text-slate-700">{fmtUSD(sup.totalPending)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase font-bold tracking-widest text-primary mb-1">LIFETIME</p>
                                    <p className="text-xl font-bold text-slate-700">{fmtUSD(totalAllocated)}</p>
                                </div>
                                <div className="pl-4">
                                    {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-300" /> : <ChevronDown className="h-5 w-5 text-slate-300" />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <CardContent className="pt-0 px-6 pb-6 space-y-6">
                                {/* ── Pending Distributions (Invoice Rows Style) ── */}
                                {pendingEntries.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 text-green-500 font-bold text-[11px] uppercase tracking-wider">
                                            <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                                                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            PAYMENTS PENDING ({pendingEntries.length})
                                        </div>
                                        
                                        <div className="space-y-2">
                                            {pendingEntries.map(entry => (
                                                <div key={entry.id} className="group relative flex items-center justify-between border border-border rounded-3xl p-5 hover:bg-slate-50/50 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="font-mono text-xs text-slate-300 bg-slate-50 px-2 py-1 rounded">
                                                            #{entry.invoiceId.slice(-6).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] text-slate-400 font-bold mb-0.5">{fmtDate(entry.createdAt)}</p>
                                                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-none px-2 rounded-full text-[10px] uppercase font-bold py-0.5">
                                                                Pending
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-12">
                                                         <div className="text-center w-24">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Student</p>
                                                            <p className="text-sm font-bold text-slate-700">{entry.student.fullName.split(' ')[0]}</p>
                                                        </div>
                                                        <div className="text-center w-24">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Paid</p>
                                                            <p className="text-sm font-bold text-slate-700">{fmtUSD(entry.paymentFromStudent)}</p>
                                                        </div>
                                                        <div className="text-center w-24">
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Share</p>
                                                            <p className="text-sm font-bold text-green-600">{fmtUSD(entry.supervisorPayout)}</p>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-4 border-l pl-8 border-slate-100">
                                                            <Popover>
                                                                <PopoverTrigger className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1.5 text-[11px] font-bold">
                                                                    <FileText className="h-4 w-4" /> Math
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-80 p-5 rounded-3xl shadow-2xl border-none">
                                                                    <p className="text-[11px] font-black text-primary uppercase tracking-widest mb-4">Calculation Formula</p>
                                                                    <div className="space-y-4">
                                                                        <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                                                                            <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Invoice Cap (Indiv Hours)</p>
                                                                            <p className="font-mono text-sm font-bold text-slate-800">
                                                                                {fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}% = {fmtUSD(entry.supervisorCapTotal)}
                                                                            </p>
                                                                        </div>
                                                                        <div className="pt-2">
                                                                            <div className="flex justify-between items-center bg-green-50 p-3 rounded-xl">
                                                                                <span className="text-[10px] font-black text-green-700 uppercase">Supervisor Share</span>
                                                                                <span className="font-black text-green-700">{fmtUSD(entry.supervisorPayout)}</span>
                                                                            </div>
                                                                        </div>
                                                                        <p className="text-[9px] text-slate-400 italic">
                                                                            * Only individual supervising hours are commissionable.
                                                                        </p>
                                                                    </div>
                                                                </PopoverContent>
                                                            </Popover>
                                                            
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="rounded-full h-9 px-4 text-xs font-bold border-slate-200 hover:bg-slate-50"
                                                                onClick={() => setSelectedEntry(entry)}
                                                            >
                                                                <Eye className="h-3.5 w-3.5 mr-2" /> Pay
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── FINAL SUMMARY (Exact Contract Summary Style) ── */}
                                <div className="pt-6 border-t border-slate-100 space-y-5">
                                    <div className="bg-slate-50/50 rounded-[2.5rem] p-8 border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-6">FINANCIAL SUMMARY</p>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            {/* Paid Box */}
                                            <div className="flex flex-col items-center justify-center bg-green-50 rounded-3xl p-6 border border-green-100 text-center">
                                                <p className="text-[10px] uppercase text-green-700 font-bold tracking-wider mb-2">PAID</p>
                                                <p className="text-3xl font-black text-green-700 leading-tight">{fmtUSD(sup.totalPaid)}</p>
                                                <p className="text-[10px] text-green-600/70 mt-1 uppercase font-bold">received</p>
                                            </div>
                                            
                                            {/* Balance Box */}
                                            <div className="flex flex-col items-center justify-center bg-amber-50 rounded-3xl p-6 border border-amber-100 text-center">
                                                <p className="text-[10px] uppercase text-amber-700 font-bold tracking-wider mb-2">BALANCE</p>
                                                <p className="text-3xl font-black text-amber-700 leading-tight">{fmtUSD(sup.totalPending)}</p>
                                                <p className="text-[10px] text-amber-600/70 mt-1 uppercase font-bold">remaining</p>
                                            </div>
                                            
                                            {/* Last Payout Box */}
                                            <div className="flex flex-col items-center justify-center bg-violet-50 rounded-3xl p-6 border border-violet-100 text-center">
                                                <p className="text-[10px] uppercase text-primary font-bold tracking-wider mb-2">LAST PAYOUT</p>
                                                {paidEntries.length > 0 ? (
                                                    <>
                                                        <p className="text-3xl font-black text-primary leading-tight">{fmtUSD(paidEntries[0].supervisorPayout)}</p>
                                                        <p className="text-[10px] text-primary/70 mt-1 uppercase font-bold">{fmtDate(paidEntries[0].paidAt)}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-3xl font-black text-violet-200 leading-tight">—</p>
                                                        <p className="text-[10px] text-violet-300 mt-1 uppercase font-bold">none yet</p>
                                                    </>
                                                )}
                                            </div>
                                            
                                            {/* Total Box */}
                                            <div className="flex flex-col items-center justify-center bg-slate-100/50 rounded-3xl p-6 border border-slate-200 text-center">
                                                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-2">TOTAL VALUE</p>
                                                <p className="text-3xl font-black text-slate-700 leading-tight">{fmtUSD(totalAllocated)}</p>
                                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold">lifetime allocated</p>
                                            </div>
                                        </div>

                                        {/* Equation Text */}
                                        <div className="mt-6 flex justify-center">
                                            <p className="text-[11px] text-center font-medium text-slate-500 animate-fade-in">
                                                <span className="text-green-600 font-bold">{fmtUSD(sup.totalPaid)}</span> paid + <span className="text-amber-600 font-bold">{fmtUSD(sup.totalPending)}</span> balance = <span className="font-black text-slate-800">{fmtUSD(totalAllocated)}</span> total allocated
                                            </p>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-6">
                                            <div className="flex justify-between text-[10px] font-black uppercase mb-1.5 tracking-tighter">
                                                <span className="text-green-600">{((sup.totalPaid / (totalAllocated || 1)) * 100).toFixed(1)}% PAID</span>
                                                <span className="text-amber-600">{((sup.totalPending / (totalAllocated || 1)) * 100).toFixed(1)}% REMAINING</span>
                                            </div>
                                            <div className="h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 p-0.5">
                                                <div
                                                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${(sup.totalPaid / (totalAllocated || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
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
