"use client"

import { Card, CardContent } from "@/components/ui/card"
import { DollarSign, ArrowRight, Building2 } from "lucide-react"

interface LedgerEntry {
    id: string
    invoiceId: string
    supervisorId: string
    studentId: string
    paymentFromStudent: number
    supervisorPayout: number
    officePayout: number
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
                                    <td className="py-3 px-4 text-right font-bold text-primary bg-primary/5">{fmtUSD(entry.officePayout)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    )
}
