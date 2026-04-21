"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, ArrowRight, Building2, Calculator, Info } from "lucide-react"
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
    student: { id: string; fullName: string }
    supervisor: { id: string; fullName: string }
    invoice: { id: string; amountDue: number; status: string; invoiceDate: string }
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
        <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-5 bg-primary/5 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center font-bold text-primary">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-base">Office Retained Revenue</h3>
                        <p className="text-xs text-muted-foreground">Portion of student payments kept by the office</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase text-primary font-bold">Total Office Net</p>
                    <p className="text-xl font-black text-primary">{fmtUSD(totalOfficeRevenue)}</p>
                </div>
            </div>

            {/* ── Global Office Financial Summary Header ── */}
            <div className="p-5 bg-slate-50 border-b border-border w-full">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-3">Global Financial Summary</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Total Money Received */}
                    <div className="flex flex-col items-center justify-center bg-slate-100 rounded-xl p-3 border border-slate-200 text-center shadow-sm">
                        <p className="text-[9px] uppercase text-slate-600 font-bold tracking-wider">Total Received</p>
                        <p className="text-xl font-black text-slate-700 leading-tight">{fmtUSD(entries.reduce((s, e) => s + Number(e.paymentFromStudent), 0))}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">from students</p>
                    </div>
                    
                    {/* Minus Sup Share */}
                    <div className="flex flex-col items-center justify-center bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-center shadow-sm">
                        <p className="text-[9px] uppercase text-blue-700 font-bold tracking-wider">Minus Sup. Share</p>
                        <p className="text-xl font-black text-blue-700 leading-tight">{fmtUSD(entries.reduce((s, e) => s + Number(e.supervisorPayout), 0))}</p>
                        <p className="text-[9px] text-blue-600/70 mt-0.5">allocated backward</p>
                    </div>
                    
                    {/* Equals Office Net */}
                    <div className="flex flex-col items-center justify-center bg-primary/10 rounded-xl p-3 border border-primary/20 text-center shadow-sm">
                        <p className="text-[9px] uppercase text-primary font-bold tracking-wider">Office Net</p>
                        <p className="text-xl font-black text-primary leading-tight">{fmtUSD(totalOfficeRevenue)}</p>
                        <p className="text-[9px] text-primary/70 mt-0.5">retained capital</p>
                    </div>
                </div>
            </div>

            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b bg-muted/20 text-muted-foreground">
                                <th className="text-left py-3 px-4 font-medium">Date</th>
                                <th className="text-left py-3 px-4 font-medium">Student</th>
                                <th className="text-left py-3 px-4 font-medium">Invoice</th>
                                <th className="text-left py-3 px-4 font-medium">Linked Supervisor</th>
                                <th className="text-right py-3 px-4 font-medium">Total Paid (Student)</th>
                                <th className="text-right py-3 px-4 font-medium">Sup. Share</th>
                                <th className="text-right py-3 px-4 font-medium text-primary">Office Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(entry => (
                                <React.Fragment key={entry.id}>
                                <tr key={entry.id} className="border-b border-muted/40 hover:bg-muted/10 transition-colors">
                                    <td className="py-3 px-4 text-muted-foreground">{fmtDate(entry.createdAt)}</td>
                                    <td className="py-3 px-4 font-semibold">{entry.student.fullName}</td>
                                    <td className="py-3 px-4">
                                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                            #{entry.invoiceId.slice(-6).toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-muted-foreground">{entry.supervisor.fullName}</td>
                                    <td className="py-3 px-4 text-right font-medium">{fmtUSD(entry.paymentFromStudent)}</td>
                                    <td className="py-3 px-4 text-right text-muted-foreground">{fmtUSD(entry.supervisorPayout)}</td>
                                    <td className="py-3 px-4 text-right font-bold text-primary bg-primary/5">{fmtUSD(entry.officePayout)}</td>
                                </tr>
                                {/* WATERFALL EXPLANATION SUB-ROW */}
                                <tr key={`doc-${entry.id}`} className="bg-slate-50/50 border-b border-muted">
                                    <td colSpan={7} className="px-4 py-3">
                                        <div className="bg-white border text-left p-3 rounded-lg shadow-sm w-full max-w-4xl">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1">
                                                <Calculator className="h-3 w-3" /> Lógica de Cálculo (Waterfall)
                                            </p>
                                            <div className="grid grid-cols-5 gap-4 text-xs items-center">
                                                <div className="border-r pr-2">
                                                    <p className="text-muted-foreground text-[10px] mb-0.5">1. Pagado por Alumno</p>
                                                    <p className="font-bold">{fmtUSD(entry.paymentFromStudent)}</p>
                                                </div>
                                                <div className="border-r pr-2">
                                                    <p className="text-muted-foreground text-[10px] mb-0.5">2. Tope del Supervisor</p>
                                                    <p className="font-bold">{fmtUSD(entry.supervisorCapTotal)}</p>
                                                </div>
                                                <div className="border-r pr-2">
                                                    <p className="text-muted-foreground text-[10px] mb-0.5">3. Saldo Disponible</p>
                                                    <p className="font-bold">{fmtUSD(entry.supervisorCapRemainingBefore)}</p>
                                                </div>
                                                <div className="border-r pr-2 bg-slate-100 p-2 rounded">
                                                    <p className="text-slate-600 font-bold text-[10px] mb-0.5">4. Resulta en Sup. Share</p>
                                                    <p className="font-black text-slate-800">{fmtUSD(entry.supervisorPayout)}</p>
                                                    <p className="text-[9px] text-muted-foreground italic mt-0.5 leading-tight">Mínimo entre el Pago (1) y Saldo (3)</p>
                                                </div>
                                                <div className="bg-primary/5 p-2 rounded">
                                                    <p className="text-primary font-bold text-[10px] mb-0.5">5. Remanente hacia Office</p>
                                                    <p className="font-black text-primary text-sm">{fmtUSD(entry.officePayout)}</p>
                                                    <p className="text-[9px] text-primary/70 mt-0.5 leading-tight">Se resta (1) - (4)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            </>
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
