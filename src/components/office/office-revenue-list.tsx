"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
    
    // Enriched math data from page.tsx
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
        <div className="space-y-4">
            <Card className="overflow-hidden border border-border shadow-sm rounded-xl bg-white">
                {/* ── HEADER ── */}
                <div className="flex items-center justify-between p-5 border-b border-muted">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base leading-tight">Office Revenue Analysis</h3>
                            <p className="text-xs text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">{entries.length} Settled Transactions</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-5">
                        <div className="hidden sm:flex items-center gap-4 text-right">
                            <div>
                                <p className="text-[10px] uppercase text-indigo-600 font-bold">Collected</p>
                                <p className="text-sm font-black text-indigo-700">{fmtUSD(totalReceived)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-amber-600 font-bold">Sup. Payouts</p>
                                <p className="text-sm font-black text-amber-700">{fmtUSD(totalToSup)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-primary font-bold">Office Net</p>
                                <p className="text-base font-black text-primary">{fmtUSD(totalOfficeRevenue)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <CardContent className="p-4 space-y-4">
                    {/* ── Settlement History (Updated Columns) ── */}
                    <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Settlement History
                        </p>
                        <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-muted-foreground">
                                        <th className="text-left py-2 px-4 font-bold uppercase text-[9px]">Student</th>
                                        <th className="text-left py-2 px-4 font-bold uppercase text-[9px]">Date</th>
                                        <th className="text-right py-2 px-4 font-bold uppercase text-[9px]">Valor Individual</th>
                                        <th className="text-right py-2 px-4 font-bold uppercase text-[9px]">Valor Grupales</th>
                                        <th className="text-right py-2 px-4 font-bold uppercase text-[9px] text-primary">Office Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted/40">
                                    {entries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-muted/10 transition-colors">
                                            <td className="py-2.5 px-4 font-bold text-slate-700">{entry.student.fullName}</td>
                                            <td className="py-2.5 px-4 text-muted-foreground">{fmtDate(entry.createdAt)}</td>
                                            <td className="py-2.5 px-4 text-right font-medium text-slate-600">
                                                {fmtUSD(entry.mathData?.officeIndivNet)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-medium text-indigo-600">
                                                {fmtUSD(entry.mathData?.officeGroupNet)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right font-black text-primary">{fmtUSD(entry.officePayout)}</td>
                                        </tr>
                                                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Revenue Summary Footer ── */}
                    <div className="rounded-xl border border-border bg-slate-50/80 p-4 space-y-3">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">REVENUE RECONCILIATION</p>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-xl p-3 border border-indigo-100 text-center">
                                <p className="text-[9px] uppercase text-indigo-700 font-bold tracking-wider">Gross</p>
                                <p className="text-lg font-black text-indigo-700 leading-tight">{fmtUSD(totalReceived)}</p>
                                <p className="text-[9px] text-indigo-600/70 mt-0.5 font-bold uppercase tracking-tighter">collected</p>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                                <p className="text-[9px] uppercase text-amber-700 font-bold tracking-wider">Payouts</p>
                                <p className="text-lg font-black text-amber-700 leading-tight">{fmtUSD(totalToSup)}</p>
                                <p className="text-[9px] text-amber-600/70 mt-0.5 font-bold uppercase tracking-tighter">expense</p>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200 text-center">
                                <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider">Margin</p>
                                <p className="text-lg font-black text-slate-700 leading-tight">{netPct.toFixed(1)}%</p>
                                <p className="text-[9px] text-slate-500 mt-0.5 font-bold uppercase tracking-tighter">retention</p>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl p-3 border border-primary/20 text-center">
                                <p className="text-[9px] uppercase text-primary font-bold tracking-wider">Office Net</p>
                                <p className="text-lg font-black text-primary">{fmtUSD(totalOfficeRevenue)}</p>
                                <p className="text-[9px] text-primary/70 mt-0.5 font-bold uppercase tracking-tighter">revenue</p>
                            </div>
                        </div>

                        <p className="text-[10px] text-center text-muted-foreground pt-1">
                            <span className="text-indigo-700 font-semibold">{fmtUSD(totalReceived)}</span> gross collected — <span className="text-amber-700 font-semibold">{fmtUSD(totalToSup)}</span> distributed = <span className="font-bold text-primary">{fmtUSD(totalOfficeRevenue)}</span> net revenue
                        </p>

                        {totalReceived > 0 && (
                            <div>
                                <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                                    <span className="text-indigo-700 font-semibold">{(100 - netPct).toFixed(1)}% distributed</span>
                                    <span className="text-primary font-semibold">{netPct.toFixed(1)}% retained</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-1000"
                                        style={{ width: `${netPct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
