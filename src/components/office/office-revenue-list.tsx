"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, CheckCircle, HelpCircle } from "lucide-react"

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
    createdAt: string

    student: { id: string; fullName: string }
    supervisor: { id: string; fullName: string }
    invoice: { id: string; amountDue: number; status: string; invoiceDate: string }
    
    // Enriched math data from page.tsx (MUST BE USED FOR THE BREAKDOWN)
    mathData?: {
        individualBilledTotal: number
        groupBilledTotal: number
        effectiveCommission: number
        formula: string
        officeIndivNet: number
        officeGroupNet: number
    }
}

interface OfficeRevenueListProps {
    entries: LedgerEntry[]
}

const fmtUSD = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"

const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "—"

export function OfficeRevenueList({ entries }: OfficeRevenueListProps) {
    if (entries.length === 0) {
        return (
            <Card className="border-none shadow-sm rounded-xl">
                <CardContent className="py-16 text-center text-muted-foreground">
                    <p className="font-medium">No office revenue entries found.</p>
                </CardContent>
            </Card>
        )
    }

    const totalReceived = entries.reduce((s, e) => s + Number(e.paymentFromStudent), 0)
    const totalToSup = entries.reduce((s, e) => s + Number(e.supervisorPayout), 0)
    const totalOfficeRevenue = entries.reduce((acc, curr) => acc + Number(curr.officePayout), 0)
    const netPct = totalReceived > 0 ? (totalOfficeRevenue / totalReceived) * 100 : 0

    return (
        <Card className="overflow-hidden border border-border shadow-sm rounded-xl bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-muted">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base leading-tight text-slate-800">Office Revenue Analysis</h3>
                        <p className="text-xs text-slate-400 mt-0.5 uppercase font-bold tracking-widest leading-none">{entries.length} Settled Transactions</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className="text-right">
                        <p className="text-[10px] uppercase text-indigo-600 font-bold tracking-widest leading-none mb-1">COLLECTED</p>
                        <p className="text-sm font-black text-slate-700">{fmtUSD(totalReceived)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase text-amber-600 font-bold tracking-widest leading-none mb-1">SUP. PAYOUTS</p>
                        <p className="text-sm font-black text-slate-700">{fmtUSD(totalToSup)}</p>
                    </div>
                    <div className="text-right pr-2">
                        <p className="text-[10px] uppercase text-primary font-bold tracking-widest leading-none mb-1">OFFICE NET</p>
                        <p className="text-base font-black text-primary">{fmtUSD(totalOfficeRevenue)}</p>
                    </div>
                </div>
            </div>

            <CardContent className="p-4 space-y-4">
                {/* Settlement History Table */}
                <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1 tracking-wider">
                        <CheckCircle className="h-3 w-3" /> SETTLEMENT HISTORY
                    </p>
                    <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="border-b bg-muted/30 text-muted-foreground">
                                    <th className="text-left py-2.5 px-4 font-bold uppercase text-[9px] tracking-tighter">Student</th>
                                    <th className="text-left py-2.5 px-4 font-bold uppercase text-[9px] tracking-tighter">Date Settled</th>
                                    <th className="text-right py-2.5 px-4 font-bold uppercase text-[9px] tracking-tighter">Individual Amount</th>
                                    <th className="text-right py-2.5 px-4 font-bold uppercase text-[9px] tracking-tighter">Group Amount</th>
                                    <th className="text-right py-2.5 px-4 font-bold uppercase text-[9px] tracking-tighter text-primary">Office Net</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted/30">
                                {entries.map(entry => {
                                    const hasHours = (entry.mathData?.individualBilledTotal || 0) > 0 || (entry.mathData?.groupBilledTotal || 0) > 0;
                                    
                                    return (
                                        <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="py-2.5 px-4 font-extrabold text-slate-700">{entry.student.fullName}</td>
                                            <td className="py-2.5 px-4 text-slate-400">{fmtDate(entry.createdAt)}</td>
                                            <td className="py-2.5 px-4 text-right font-bold text-slate-600">
                                                <div className="flex items-center justify-end gap-1">
                                                    {!hasHours && (
                                                        <span className="text-[8px] text-amber-500 font-bold bg-amber-50 px-1 rounded-sm border border-amber-100 uppercase" title="No detailed hours linked. Attributed to Individual.">Plan</span>
                                                    )}
                                                    {fmtUSD(entry.mathData?.officeIndivNet)}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-bold text-indigo-600">
                                                {fmtUSD(entry.mathData?.officeGroupNet)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-black text-primary text-sm">{fmtUSD(entry.officePayout)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Revenue Reconciliation Summary */}
                <div className="rounded-xl border border-border bg-slate-50/80 p-5 space-y-4">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest text-center">REVENUE RECONCILIATION</p>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center shadow-sm">
                            <p className="text-[9px] uppercase text-indigo-700 font-bold tracking-wider mb-1">Gross</p>
                            <p className="text-lg font-black text-indigo-700 leading-tight">{fmtUSD(totalReceived)}</p>
                            <p className="text-[9px] text-indigo-600/70 mt-0.5 font-bold uppercase tracking-tighter">collected</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center bg-amber-50 rounded-xl p-3 border border-amber-100 text-center shadow-sm">
                            <p className="text-[9px] uppercase text-amber-700 font-bold tracking-wider mb-1">Payouts</p>
                            <p className="text-lg font-black text-amber-700 leading-tight">{fmtUSD(totalToSup)}</p>
                            <p className="text-[9px] text-amber-600/70 mt-0.5 font-bold uppercase tracking-tighter">expense</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200 text-center shadow-sm">
                            <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider mb-1">Margin</p>
                            <p className="text-lg font-black text-slate-700 leading-tight">{netPct.toFixed(1)}%</p>
                            <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tighter">retention</p>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center bg-primary rounded-xl p-3 border border-primary text-center shadow-md">
                            <p className="text-[9px] uppercase text-white font-bold tracking-wider mb-1">Office Net</p>
                            <p className="text-lg font-black text-white leading-tight">{fmtUSD(totalOfficeRevenue)}</p>
                            <p className="text-[9px] text-white/70 mt-0.5 font-bold uppercase tracking-tighter">final income</p>
                        </div>
                    </div>

                    <div className="mt-2 flex justify-center">
                        <p className="text-[10px] text-center font-bold text-slate-500 bg-white px-4 py-1 rounded-full border shadow-sm">
                            <span className="text-indigo-700 font-black">{fmtUSD(totalReceived)}</span> collected — <span className="text-amber-700 font-black">{fmtUSD(totalToSup)}</span> distributed = <span className="font-black text-primary">{fmtUSD(totalOfficeRevenue)}</span> net revenue
                        </p>
                    </div>

                    {totalReceived > 0 && (
                        <div className="pt-2">
                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1 tracking-widest uppercase">
                                <span>Distribution {(100 - netPct).toFixed(1)}%</span>
                                <span>Retention {netPct.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-200 overflow-hidden p-0.5 border border-slate-100 shadow-inner">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-1000 shadow-sm"
                                    style={{ width: `${netPct}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
