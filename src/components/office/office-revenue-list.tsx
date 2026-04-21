"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Calculator, Info, FileText } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    supervisor: { id: string; fullName: string }
    invoice: { id: string; amountDue: number; status: string; invoiceDate: string }
    
    // Enriched math data from page.tsx
    mathData?: {
        individualBilledTotal: number
        effectiveCommission: number
        formula: string
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
            <Card className="border-none shadow-sm rounded-3xl">
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
        <div className="space-y-6">
            <Card className="overflow-hidden border border-border shadow-md rounded-[2.5rem] bg-white">
                {/* ── HEADER ── */}
                <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="h-16 w-16 rounded-[1.5rem] bg-primary flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20">
                            <Building2 className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-black text-2xl text-slate-800 tracking-tight">Main Office Revenue</h3>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none rounded-full px-3 text-[10px] uppercase font-black">
                                    Entity: ABA Supervision
                                </Badge>
                                <span className="text-slate-300 text-xs">|</span>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{entries.length} Transactions Settled</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-10">
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-slate-400 mb-1">TOTAL COLLECTED</p>
                            <p className="text-2xl font-black text-slate-800">{fmtUSD(totalReceived)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-amber-600 mb-1">SUP. EXPENSE</p>
                            <p className="text-2xl font-black text-slate-800">{fmtUSD(totalToSup)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase font-black tracking-[0.1em] text-primary mb-1">OFFICE NET</p>
                            <p className="text-3xl font-black text-primary animate-fade-in">{fmtUSD(totalOfficeRevenue)}</p>
                        </div>
                    </div>
                </div>

                <CardContent className="p-8 space-y-8">
                     {/* ── TRANSACTIONS LIST ── */}
                     <div className="space-y-3">
                         <div className="flex items-center justify-between px-2">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</p>
                            <p className="text-[10px] font-bold text-primary uppercase bg-primary/5 px-2 py-1 rounded-full">Sorted by Recency</p>
                         </div>
                         
                         <div className="space-y-2">
                             {entries.map(entry => (
                                 <div key={entry.id} className="group relative flex items-center justify-between border border-border/60 rounded-3xl p-5 hover:bg-slate-50 transition-all hover:shadow-sm">
                                     <div className="flex items-center gap-6">
                                         <div className="font-mono text-xs text-slate-300 bg-slate-50 px-2 py-1 rounded-lg">
                                             #{entry.invoiceId.slice(-6).toUpperCase()}
                                         </div>
                                         <div className="space-y-0.5">
                                             <p className="text-[11px] text-slate-400 font-black uppercase tracking-tighter">{fmtDate(entry.createdAt)}</p>
                                             <p className="text-[13px] font-bold text-slate-800">{entry.student.fullName}</p>
                                         </div>
                                     </div>

                                     <div className="flex items-center gap-14">
                                         <div className="text-center w-28">
                                             <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">Supervisor</p>
                                             <p className="text-xs font-bold text-slate-600 truncate max-w-[110px]">{entry.supervisor.fullName.split(' ')[0]}</p>
                                         </div>
                                         <div className="text-center w-24">
                                             <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">Student Paid</p>
                                             <p className="text-sm font-bold text-slate-700">{fmtUSD(entry.paymentFromStudent)}</p>
                                         </div>
                                         <div className="text-center w-24">
                                             <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">Sup. Share</p>
                                             <p className="text-xs font-bold text-slate-400">− {fmtUSD(entry.supervisorPayout)}</p>
                                         </div>
                                         
                                         <div className="flex items-center gap-6 border-l pl-8 border-slate-100">
                                             <div className="text-right">
                                                 <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-0.5">NET PROFIT</p>
                                                 <p className="text-lg font-black text-primary">{fmtUSD(entry.officePayout)}</p>
                                             </div>
                                             
                                             <Popover>
                                                 <PopoverTrigger className="text-slate-200 hover:text-primary transition-colors">
                                                     <Calculator className="h-5 w-5" />
                                                 </PopoverTrigger>
                                                 <PopoverContent className="w-80 p-6 rounded-[2rem] shadow-2xl border-none">
                                                     <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] mb-4">Calculation Logic</p>
                                                     <div className="space-y-4">
                                                         <div className="bg-slate-50 p-4 rounded-2xl border border-dashed border-slate-200">
                                                             <p className="text-[10px] text-slate-400 uppercase font-extrabold mb-2">Effective Split (Indiv Hours)</p>
                                                             <p className="font-mono text-sm font-bold text-slate-800 leading-none">
                                                                 {fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}% = {fmtUSD(entry.supervisorCapTotal)}
                                                             </p>
                                                         </div>
                                                         <div className="bg-primary p-4 rounded-2xl text-white shadow-lg shadow-primary/20">
                                                             <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                                                                 <span>Final Office Net</span>
                                                                 <span className="text-lg">{fmtUSD(entry.officePayout)}</span>
                                                             </div>
                                                         </div>
                                                         <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                                                             * Calculado restando el pago total menos la comisión del supervisor según tope de horas individuales.
                                                         </p>
                                                     </div>
                                                 </PopoverContent>
                                             </Popover>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>

                    {/* ── PROFIT SUMMARY (Student Style) ── */}
                    <div className="pt-8 border-t border-slate-50">
                        <div className="bg-slate-50/50 rounded-[3rem] p-10 border border-slate-100/50">
                            <p className="text-[11px] uppercase font-black text-slate-400 tracking-[0.2em] mb-8 text-center">GLOBAL REVENUE RECONCILIATION</p>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                {/* Total Received */}
                                <div className="flex flex-col items-center justify-center bg-indigo-50 rounded-[2rem] p-8 border border-indigo-100 text-center transition-transform hover:scale-[1.02]">
                                    <p className="text-[11px] uppercase text-indigo-700 font-black tracking-widest mb-2">TOTAL RECEIVED</p>
                                    <p className="text-4xl font-black text-indigo-700 leading-tight">{fmtUSD(totalReceived)}</p>
                                    <p className="text-[10px] text-indigo-600/70 mt-1 uppercase font-black">Gross Income</p>
                                </div>
                                
                                {/* Total Comm */}
                                <div className="flex flex-col items-center justify-center bg-amber-50 rounded-[2rem] p-8 border border-amber-100 text-center transition-transform hover:scale-[1.02]">
                                    <p className="text-[11px] uppercase text-amber-700 font-black tracking-widest mb-2">SUP. PAYOUTS</p>
                                    <p className="text-4xl font-black text-amber-700 leading-tight">{fmtUSD(totalToSup)}</p>
                                    <p className="text-[10px] text-amber-600/70 mt-1 uppercase font-black">Expense Split</p>
                                </div>
                                
                                {/* Placeholder / Efficiency */}
                                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-[2rem] p-8 border border-slate-200 text-center transition-transform hover:scale-[1.02]">
                                    <p className="text-[11px] uppercase text-slate-500 font-black tracking-widest mb-2">PROFIT MARGIN</p>
                                    <p className="text-4xl font-black text-slate-700 leading-tight">{netPct.toFixed(1)}%</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-black">Calculated Retension</p>
                                </div>
                                
                                {/* Net Revenue */}
                                <div className="flex flex-col items-center justify-center bg-primary rounded-[2rem] p-8 border border-primary text-center shadow-xl shadow-primary/20 transition-transform hover:scale-[1.02]">
                                    <p className="text-[11px] uppercase text-white font-black tracking-widest mb-2 opacity-90">OFFICE NET</p>
                                    <p className="text-4xl font-black text-white leading-tight">{fmtUSD(totalOfficeRevenue)}</p>
                                    <p className="text-[10px] text-white/70 mt-1 uppercase font-black">Retained Capital</p>
                                </div>
                            </div>

                            {/* Equation */}
                            <div className="mt-10 flex justify-center">
                                <p className="text-sm text-center font-bold text-slate-500 bg-white px-6 py-2 rounded-full border border-slate-100">
                                    <span className="text-indigo-600 font-black">{fmtUSD(totalReceived)}</span> collected 
                                    {" — "} 
                                    <span className="text-amber-600 font-black">{fmtUSD(totalToSup)}</span> distributed 
                                    {" = "} 
                                    <span className="font-black text-primary">{fmtUSD(totalOfficeRevenue)}</span> net revenue
                                </p>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-10 max-w-4xl mx-auto">
                                <div className="flex justify-between text-[11px] font-black uppercase mb-2 tracking-widest">
                                    <span className="text-indigo-600">DISTRIBUTION { (100 - netPct).toFixed(1) }%</span>
                                    <span className="text-primary">RETENTION { netPct.toFixed(1) }%</span>
                                </div>
                                <div className="h-5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 p-1 shadow-inner">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary to-indigo-400 rounded-full transition-all duration-[1.5s] ease-out shadow-lg"
                                        style={{ width: `${netPct}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
