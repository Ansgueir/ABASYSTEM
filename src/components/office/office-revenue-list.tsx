"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, Building2, Calculator, Info, ExternalLink } from "lucide-react"
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

    const totalOfficeRevenue = entries.reduce((acc, curr) => acc + Number(curr.officePayout), 0)

    return (
        <Card className="overflow-hidden border-none shadow-lg">
            {/* ── Dashboard Stats Overlay (CLEAN) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-200">
                <div className="p-6 border-r border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Total Student Payments</p>
                    <p className="text-2xl font-black text-slate-700">{fmtUSD(entries.reduce((s, e) => s + Number(e.paymentFromStudent), 0))}</p>
                </div>
                <div className="p-6 border-r border-slate-200">
                    <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider mb-1">Total Supervisor Shares</p>
                    <p className="text-2xl font-black text-blue-700">{fmtUSD(entries.reduce((s, e) => s + Number(e.supervisorPayout), 0))}</p>
                </div>
                <div className="p-6 bg-primary/5">
                    <p className="text-[10px] uppercase font-bold text-primary tracking-wider mb-1">Net Office Revenue</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-primary leading-tight">{fmtUSD(totalOfficeRevenue)}</p>
                        <span className="text-[10px] font-bold text-primary/60 px-1.5 py-0.5 rounded bg-primary/10">PROFIT</span>
                    </div>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b bg-slate-50/50 text-slate-500">
                                <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-[10px]">Date</th>
                                <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-[10px]">Entity / Student</th>
                                <th className="text-left py-4 px-6 font-bold uppercase tracking-wider text-[10px]">Invoice</th>
                                <th className="text-right py-4 px-6 font-bold uppercase tracking-wider text-[10px]">Received</th>
                                <th className="text-right py-4 px-6 font-bold uppercase tracking-wider text-[10px]">Logic / Split</th>
                                <th className="text-right py-4 px-6 font-bold uppercase tracking-wider text-[10px] text-primary bg-primary/5">Net Stays</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.map(entry => (
                                <tr key={entry.id} className="group hover:bg-slate-50/80 transition-colors">
                                    <td className="py-4 px-6 text-slate-500 whitespace-nowrap">{fmtDate(entry.createdAt)}</td>
                                    <td className="py-4 px-6">
                                        <p className="font-bold text-slate-800">{entry.student.fullName}</p>
                                        <p className="text-[10px] text-slate-400">Sup: {entry.supervisor.fullName}</p>
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                            #{entry.invoiceId.slice(-6).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-right font-semibold text-slate-700">{fmtUSD(entry.paymentFromStudent)}</td>
                                    <td className="py-4 px-6 text-right">
                                        <Popover>
                                            <PopoverTrigger className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-100">
                                                <Calculator className="h-3 w-3" />
                                                <span className="font-bold">Split Math</span>
                                                <Info className="h-3 w-3 opacity-50" />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-0 overflow-hidden border-none shadow-2xl" side="left">
                                                <div className="bg-slate-900 text-white p-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Calculator className="h-4 w-4 text-blue-400" />
                                                        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">Waterfall Calculation</p>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 leading-relaxed italic">
                                                        Regla: Solo las horas individuales generan comisión para el supervisor.
                                                    </p>
                                                </div>
                                                <div className="p-4 space-y-4 bg-white">
                                                    {/* Step 1: Total Cap */}
                                                    <div>
                                                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-1.5">1. Tope Total para esta Factura</p>
                                                        <div className="flex items-center justify-between text-xs font-mono bg-slate-50 p-2 rounded border border-slate-100">
                                                            <span className="text-slate-500">{fmtUSD(entry.mathData?.individualBilledTotal)} × {(entry.mathData?.effectiveCommission || 0.6) * 100}%</span>
                                                            <span className="font-bold text-slate-800">{fmtUSD(entry.supervisorCapTotal)}</span>
                                                        </div>
                                                    </div>

                                                    {/* Step 2: Distribution */}
                                                    <div>
                                                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-1.5">2. Distribución de este Pago</p>
                                                        <div className="space-y-1.5">
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-slate-600">Supervisor Share</span>
                                                                <span className="font-bold text-blue-600">− {fmtUSD(entry.supervisorPayout)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs pt-1.5 border-t border-dashed">
                                                                <span className="font-bold text-slate-800 uppercase text-[9px]">Retenido por Oficina</span>
                                                                <span className="font-black text-primary text-sm">{fmtUSD(entry.officePayout)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                    <td className="py-4 px-6 text-right font-black text-primary bg-primary/5 text-sm">{fmtUSD(entry.officePayout)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
