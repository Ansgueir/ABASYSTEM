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
                                                <React.Fragment key={entry.id}>
                                                    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
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
                                                    <div className="mt-3 bg-white border rounded-lg p-3 text-left">
                                                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                                            <Calculator className="h-3 w-3" /> Explicación Matemática (Waterfall)
                                                        </p>
                                                        <div className="grid grid-cols-4 gap-4 text-xs">
                                                            <div className="border-r pr-2">
                                                                <p className="text-muted-foreground text-[10px] mb-0.5">1. Pagado por Alumno</p>
                                                                <p className="font-bold">{fmtUSD(entry.paymentFromStudent)}</p>
                                                            </div>
                                                            <div className="border-r pr-2">
                                                                <p className="text-muted-foreground text-[10px] mb-0.5">2. Tope del Supervisor</p>
                                                                <p className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</p>
                                                                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">horas indiv. × comisión</p>
                                                            </div>
                                                            <div className="border-r pr-2">
                                                                <p className="text-muted-foreground text-[10px] mb-0.5">3. Saldo Disponible</p>
                                                                <p className="font-bold">{fmtUSD(entry.supervisorCapRemainingBefore)}</p>
                                                            </div>
                                                            <div className="bg-amber-50 p-2 rounded">
                                                                <p className="text-amber-800 font-bold text-[10px] mb-0.5">4. Resulta en Sup. Share</p>
                                                                <p className="font-black text-amber-900 text-sm">{fmtUSD(entry.supervisorPayout)}</p>
                                                                <p className="text-[9px] text-amber-700/70 mt-0.5 leading-tight">Mínimo entre Pago (1) y Saldo (3)</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </React.Fragment>
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
                                                        <React.Fragment key={entry.id}>
                                                        <tr className="border-b border-muted/40 hover:bg-muted/10">
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
                                                        {/* EXPLICIT MATH SUB-ROW */}
                                                        <tr className="bg-slate-50/50 border-b border-muted/40">
                                                            <td colSpan={6} className="px-4 py-2">
                                                                <div className="bg-white border rounded p-2 text-left mb-2 mt-1">
                                                                    <p className="text-[9px] font-bold text-green-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                                                                        <Calculator className="h-3 w-3" /> Desglose (Waterfall)
                                                                    </p>
                                                                    <div className="grid grid-cols-4 gap-2 text-[10px]">
                                                                        <div className="border-r">
                                                                            <p className="text-muted-foreground mb-0.5">1. Pagado por Alumno</p>
                                                                            <p className="font-bold">{fmtUSD(entry.paymentFromStudent)}</p>
                                                                        </div>
                                                                        <div className="border-r">
                                                                            <p className="text-muted-foreground mb-0.5">2. Tope del Supervisor</p>
                                                                            <p className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</p>
                                                                        </div>
                                                                        <div className="border-r">
                                                                            <p className="text-muted-foreground mb-0.5">3. Saldo Disponible</p>
                                                                            <p className="font-bold">{fmtUSD(entry.supervisorCapRemainingBefore)}</p>
                                                                        </div>
                                                                        <div className="bg-green-50 px-2 rounded">
                                                                            <p className="text-green-800 font-bold mb-0.5">4. Mínimo = Sup Share</p>
                                                                            <p className="font-black text-green-900">{fmtUSD(entry.supervisorPayout)}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        </React.Fragment>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {sup.entries.length === 0 && (
                                    <p className="text-xs text-center text-muted-foreground py-4">No entries yet for this supervisor.</p>
                                )}

                                {/* ── Supervisor Financial Summary Footer ── */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3 mt-4">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Financial Summary</p>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {/* Paid */}
                                        <div className="flex flex-col items-center justify-center bg-green-50 rounded-xl p-3 border border-green-100 text-center">
                                            <p className="text-[9px] uppercase text-green-700 font-bold tracking-wider">Paid to Supervisor</p>
                                            <p className="text-lg font-black text-green-700 leading-tight">{fmtUSD(sup.totalPaid)}</p>
                                            <p className="text-[9px] text-green-600/70 mt-0.5">cleared payments</p>
                                        </div>
                                        
                                        {/* Pending */}
                                        <div className="flex flex-col items-center justify-center bg-amber-50 rounded-xl p-3 border border-amber-100 text-center">
                                            <p className="text-[9px] uppercase text-amber-700 font-bold tracking-wider">Pending Payout</p>
                                            <p className="text-lg font-black text-amber-700 leading-tight">{fmtUSD(sup.totalPending)}</p>
                                            <p className="text-[9px] text-amber-600/70 mt-0.5">waiting for transfer</p>
                                        </div>
                                        
                                        {/* Earnings */}
                                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200 text-center">
                                            <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider">Total Earnings</p>
                                            <p className="text-lg font-black text-slate-700 leading-tight">{fmtUSD(sup.totalPaid + sup.totalPending)}</p>
                                            <p className="text-[9px] text-slate-500 mt-0.5">lifetime derived value</p>
                                        </div>
                                    </div>
                                    
                                    {/* Identity equation */}
                                    {(sup.totalPaid + sup.totalPending) > 0 && (
                                        <p className="text-[10px] text-center text-muted-foreground pt-1">
                                            <span className="text-green-700 font-semibold">{fmtUSD(sup.totalPaid)}</span> paid
                                            {" + "}
                                            <span className="text-amber-700 font-semibold">{fmtUSD(sup.totalPending)}</span> pending
                                            {" = "}
                                            <span className="font-bold text-slate-700">{fmtUSD(sup.totalPaid + sup.totalPending)}</span> total earnings
                                        </p>
                                    )}
                                </div>
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
