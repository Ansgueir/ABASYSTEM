"use client"

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
                                    <td className="py-3 px-4 text-right font-bold text-primary bg-primary/5">
                                        <Popover>
                                            <PopoverTrigger className="flex items-center justify-end gap-1 w-full hover:text-primary/70 transition-colors">
                                                {fmtUSD(entry.officePayout)} <Info className="h-3 w-3 opacity-50" />
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-4" side="left">
                                                <div className="space-y-3 text-sm">
                                                    <div className="flex items-center gap-2 border-b pb-2">
                                                        <Calculator className="h-4 w-4 text-primary" />
                                                        <p className="font-bold">Waterfall Math</p>
                                                    </div>
                                                    
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Student Paid</span>
                                                            <span>{fmtUSD(entry.paymentFromStudent)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Sup Total Cap (Invoice)</span>
                                                            <span>{fmtUSD(entry.supervisorCapTotal)}</span>
                                                        </div>
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Sup Remainder Prev.</span>
                                                            <span>{fmtUSD(entry.supervisorCapRemainingBefore)}</span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-muted p-2 rounded text-xs space-y-1">
                                                        <p className="text-muted-foreground italic">Rule: Supervisor gets paid up to their remaining invoice cap.</p>
                                                        <div className="flex justify-between font-medium text-slate-700">
                                                            <span>Supervisor Share</span>
                                                            <span>{fmtUSD(entry.supervisorPayout)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between font-bold text-primary border-t pt-2">
                                                        <span>Office Retained (Rest)</span>
                                                        <span>{fmtUSD(entry.officePayout)}</span>
                                                    </div>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Global Office Financial Summary Footer ── */}
                <div className="p-5 bg-slate-50 border-t border-border mt-auto w-full">
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
            </CardContent>
        </Card>
    )
}
