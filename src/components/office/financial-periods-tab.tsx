"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { generateOrUpdateFinancialPeriods, updateFinancialPeriod } from "@/actions/financial-periods"
import { Loader2, RefreshCw } from "lucide-react"

export function FinancialPeriodsTab({ studentId, periods }: { studentId: string, periods: any[] }) {
    const [isPending, startTransition] = useTransition()
    const [editingPeriod, setEditingPeriod] = useState<number | null>(null)
    const [editData, setEditData] = useState<any>({})

    const sortedPeriods = [...periods].sort((a, b) => a.periodNumber - b.periodNumber)

    const handleGenerate = () => {
        startTransition(async () => {
            const res = await generateOrUpdateFinancialPeriods(studentId)
            if (res.error) toast.error(res.error)
            else toast.success("48 Periods generated/updated successfully")
        })
    }

    const handleEdit = (p: any) => {
        setEditingPeriod(p.periodNumber)
        setEditData({
            amountDueOffice: Number(p.amountDueOffice),
            amountDueAnalyst: Number(p.amountDueAnalyst),
            accumulatedPaidOffice: Number(p.accumulatedPaidOffice),
            accumulatedPaidAnalyst: Number(p.accumulatedPaidAnalyst),
        })
    }

    const handleSave = (periodNumber: number) => {
        startTransition(async () => {
            const res = await updateFinancialPeriod(studentId, periodNumber, editData)
            if (res.error) toast.error(res.error)
            else {
                toast.success("Period updated")
                setEditingPeriod(null)
            }
        })
    }

    if (sortedPeriods.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-card border rounded-xl space-y-4">
                <p className="text-muted-foreground text-center">No financial periods generated yet. The full 48-period mirror expects these rows to exist.</p>
                <Button onClick={handleGenerate} disabled={isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Generate 48 Periods Data
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 border rounded-xl">
                <div>
                    <h3 className="font-semibold">Financial Periods (1-48)</h3>
                    <p className="text-sm text-muted-foreground">Modify amount due or accumulated payments. Accumulatives update automatically.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />} Refresh Base
                </Button>
            </div>

            <div className="rounded-xl border bg-card overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground">
                        <tr>
                            <th className="px-4 py-3 font-medium">Period</th>
                            <th className="px-4 py-3 font-medium">Label</th>
                            <th className="px-4 py-3 font-medium text-right">Due Office ($)</th>
                            <th className="px-4 py-3 font-medium text-right">Due Analyst ($)</th>
                            <th className="px-4 py-3 font-medium text-right">Acum. Due Office ($)</th>
                            <th className="px-4 py-3 font-medium text-right">Acum. Paid Office ($)</th>
                            <th className="px-4 py-3 font-medium text-right">Acum. Paid Analyst ($)</th>
                            <th className="px-4 py-3 font-medium text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedPeriods.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3 font-medium">{p.periodNumber}</td>
                                <td className="px-4 py-3">{p.monthYearLabel}</td>

                                <td className="px-4 py-3 text-right">
                                    {editingPeriod === p.periodNumber ? (
                                        <Input type="number" step="0.01" className="w-24 ml-auto h-7 text-right" value={editData.amountDueOffice} onChange={e => setEditData({ ...editData, amountDueOffice: e.target.value })} />
                                    ) : (
                                        <span>${Number(p.amountDueOffice).toFixed(2)}</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    {editingPeriod === p.periodNumber ? (
                                        <Input type="number" step="0.01" className="w-24 ml-auto h-7 text-right" value={editData.amountDueAnalyst} onChange={e => setEditData({ ...editData, amountDueAnalyst: e.target.value })} />
                                    ) : (
                                        <span>${Number(p.amountDueAnalyst).toFixed(2)}</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-right font-semibold text-primary/80">
                                    ${Number(p.accumulatedDueOffice).toFixed(2)}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    {editingPeriod === p.periodNumber ? (
                                        <Input type="number" step="0.01" className="w-24 ml-auto h-7 text-right" value={editData.accumulatedPaidOffice} onChange={e => setEditData({ ...editData, accumulatedPaidOffice: e.target.value })} />
                                    ) : (
                                        <span className="text-success font-semibold">${Number(p.accumulatedPaidOffice).toFixed(2)}</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-right">
                                    {editingPeriod === p.periodNumber ? (
                                        <Input type="number" step="0.01" className="w-24 ml-auto h-7 text-right" value={editData.accumulatedPaidAnalyst} onChange={e => setEditData({ ...editData, accumulatedPaidAnalyst: e.target.value })} />
                                    ) : (
                                        <span className="text-success font-semibold">${Number(p.accumulatedPaidAnalyst).toFixed(2)}</span>
                                    )}
                                </td>

                                <td className="px-4 py-3 text-center">
                                    {editingPeriod === p.periodNumber ? (
                                        <div className="flex justify-center gap-2">
                                            <Button size="sm" variant="default" onClick={() => handleSave(p.periodNumber)} disabled={isPending}>Save</Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingPeriod(null)} disabled={isPending}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(p)}>Edit</Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
