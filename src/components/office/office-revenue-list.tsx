"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Calculator, Info } from "lucide-react"
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
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No office revenue entries found.</p>
                </CardContent>
            </Card>
        )
    }

    const totalReceived = entries.reduce((s, e) => s + Number(e.paymentFromStudent), 0)
    const totalToSup = entries.reduce((s, e) => s + Number(e.supervisorPayout), 0)
    const totalOfficeRevenue = entries.reduce((acc, curr) => acc + Number(curr.officePayout), 0)

    return (
        <Card className="overflow-hidden border border-border shadow-sm">
            {/* ── Global Summary Header (Styled like Student Tab) ── */}
            <div className="p-4 bg-muted/30 border-b border-border">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-3">Office Financial Summary</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Received */}
                    <div className="flex flex-col items-center justify-center bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-center">
                        <p className="text-[9px] uppercase text-indigo-700 font-bold tracking-wider">Total Received</p>
                        <p className="text-xl font-black text-indigo-700 leading-tight">{fmtUSD(totalReceived)}</p>
                        <p className="text-[9px] text-indigo-600/70 mt-0.5">from students</p>
                    </div>
                    
                    {/* Distributed */}
                    <div className="flex flex-col items-center justify-center bg-slate-50 rounded-xl p-3 border border-slate-200 text-center">
                        <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider">Sup. Distributed</p>
                        <p className="text-xl font-black text-slate-700 leading-tight">{fmtUSD(totalToSup)}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">commissions</p>
                    </div>
                    
                    {/* Office Net */}
                    <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl p-3 border border-primary/20 text-center">
                        <p className="text-[9px] uppercase text-primary font-bold tracking-wider">Office Net</p>
                        <p className="text-xl font-black text-primary leading-tight">{fmtUSD(totalOfficeRevenue)}</p>
                        <p className="text-[9px] text-primary/70 mt-0.5">retained revenue</p>
                    </div>
                </div>
                {/* Visual Equation */}
                <p className="text-[10px] text-center text-muted-foreground pt-3">
                    <span className="text-indigo-700 font-semibold">{fmtUSD(totalReceived)}</span> received 
                    {" — "} 
                    <span className="text-slate-600 font-semibold">{fmtUSD(totalToSup)}</span> distributed 
                    {" = "} 
                    <span className="font-bold text-primary">{fmtUSD(totalOfficeRevenue)}</span> net revenue
                </p>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b bg-muted/50 text-muted-foreground">
                                <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[10px]">Date</th>
                                <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[10px]">Entity / Student</th>
                                <th className="text-left py-3 px-4 font-bold uppercase tracking-tighter text-[10px]">Invoice</th>
                                <th className="text-right py-3 px-4 font-bold uppercase tracking-tighter text-[10px]">Received</th>
                                <th className="text-center py-3 px-4 font-bold uppercase tracking-tighter text-[10px]">Math</th>
                                <th className="text-right py-3 px-4 font-bold uppercase tracking-tighter text-[10px] text-primary">Office Share</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="py-4 px-4 text-muted-foreground">{fmtDate(entry.createdAt)}</td>
                                    <td className="py-4 px-4">
                                        <p className="font-bold">{entry.student.fullName}</p>
                                        <p className="text-[10px] text-muted-foreground">Sup: {entry.supervisor.fullName}</p>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className="font-mono text-[10px] bg-muted px-2 py-1 rounded">
                                            #{entry.invoiceId.slice(-6).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right font-medium">{fmtUSD(entry.paymentFromStudent)}</td>
                                    <td className="py-4 px-4 text-center">
                                        <Popover>
                                            <PopoverTrigger className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-muted">
                                                <Calculator className="h-4 w-4" />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-72 p-4 shadow-xl border-border" side="top">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 border-b pb-2">
                                                        <Calculator className="h-4 w-4 text-primary" />
                                                        <p className="text-xs font-bold uppercase text-primary tracking-widest">Waterfall Logic</p>
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <div>
                                                            <p className="text-[9px] uppercase font-bold text-muted-foreground mb-1">Total Cap (Individual Hours)</p>
                                                            <p className="text-xs font-mono bg-muted p-2 rounded flex justify-between">
                                                                <span className="text-muted-foreground">{fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}% =</span>
                                                                <span className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</span>
                                                            </p>
                                                        </div>
                                                        
                                                        <div className="pt-2 border-t border-dashed">
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="text-muted-foreground">Supervisor Share</span>
                                                                <span className="font-bold">{fmtUSD(entry.supervisorPayout)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-sm font-black text-primary pt-1">
                                                                <span>OFFICE NET</span>
                                                                <span>{fmtUSD(entry.officePayout)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <p className="text-[9px] text-muted-foreground italic leading-tight">
                                                        * Only INDIVIDUAL hours generate commissions. Administrative fees and group sessions stay in the office.
                                                    </p>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                    <td className="py-4 px-4 text-right font-black text-primary text-sm">{fmtUSD(entry.officePayout)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
