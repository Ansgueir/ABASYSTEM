"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { payToSupervisorFromLedger } from "@/actions/billing"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2, Clock, DollarSign, Calculator, BookOpen } from "lucide-react"

interface LedgerEntry {
    id: string
    invoiceId: string
    supervisorId: string
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
    student: { fullName: string }
}

interface SupervisorPayoutModalProps {
    isOpen: boolean
    onClose: () => void
    entry: LedgerEntry
}

const fmtUSD = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"

export function SupervisorPayoutModal({ isOpen, onClose, entry }: SupervisorPayoutModalProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    // Manual fields — pre-filled from plan if not yet set by previous payment
    const [amount, setAmount] = useState(Number(entry.supervisorPayout).toFixed(2))
    const [method, setMethod] = useState("ZELLE")
    const [reference, setReference] = useState("")
    const [notes, setNotes] = useState("")

    useEffect(() => {
        setAmount(Number(entry.supervisorPayout).toFixed(2))
    }, [entry])

    async function handleSubmit() {
        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Please enter a valid amount")
            return
        }
        if (numAmount > Number(entry.supervisorPayout) + 0.01) {
            toast.error(`Amount exceeds the calculated payout (${fmtUSD(entry.supervisorPayout)})`)
            return
        }

        setLoading(true)
        try {
            const res = await payToSupervisorFromLedger({
                ledgerEntryId: entry.id,
                amount: numAmount,
                paymentMethod: method,
                paymentReference: reference || undefined,
                paymentNotes: notes || undefined
            })

            if (res.success) {
                toast.success("Supervisor payment recorded ✓")
                onClose()
                router.refresh()
            } else {
                toast.error(res.error || "Failed to record payment")
            }
        } catch {
            toast.error("Unexpected error. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
            <DialogContent className="sm:max-w-[580px] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-amber-500" />
                        Pay Supervisor — {entry.student.fullName}
                    </DialogTitle>
                    <DialogDescription>
                        Invoice #{entry.invoiceId.slice(-6).toUpperCase()} · Review all data before confirming.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">

                    {/* ── BLOQUE 1: AUTO del Plan ── */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-blue-700 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5" /> Plan Data (Read-Only)
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="text-center">
                                <p className="text-[9px] uppercase text-blue-500 font-bold">Monthly Payment</p>
                                <p className="text-sm font-black text-blue-800">{fmtUSD(entry.planMonthlyPayment)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] uppercase text-blue-500 font-bold">Hrs/Month</p>
                                <p className="text-sm font-black text-blue-800">{entry.planHoursPerMonth != null ? `${entry.planHoursPerMonth}h` : "—"}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] uppercase text-blue-500 font-bold">Indiv Target</p>
                                <p className="text-sm font-black text-blue-800">{entry.planIndividualSupervisedTarget != null ? `${Number(entry.planIndividualSupervisedTarget).toFixed(1)}h` : "—"}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] uppercase text-blue-500 font-bold">Group Target</p>
                                <p className="text-sm font-black text-blue-800">{entry.planGroupSupervisionTarget != null ? `${Number(entry.planGroupSupervisionTarget).toFixed(1)}h` : "—"}</p>
                            </div>
                        </div>
                        
                        {(entry.planIndividualSupervisedDelta != null || entry.planGroupSupervisionDelta != null) && (
                            <div className="mt-3 pt-3 border-t border-blue-100 grid grid-cols-2 gap-3">
                                <div className="text-center">
                                    <p className="text-[9px] uppercase text-indigo-500 font-bold">Plan Indiv Delta</p>
                                    <p className="text-xs font-bold text-indigo-800">{entry.planIndividualSupervisedDelta != null ? `${Number(entry.planIndividualSupervisedDelta).toFixed(1)}h` : "—"}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-[9px] uppercase text-indigo-500 font-bold">Plan Group Delta</p>
                                    <p className="text-xs font-bold text-indigo-800">{entry.planGroupSupervisionDelta != null ? `${Number(entry.planGroupSupervisionDelta).toFixed(1)}h` : "—"}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── BLOQUE 2: AUTO Waterfall ── */}
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-2">
                        <p className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1.5">
                            <Calculator className="h-3.5 w-3.5" /> Waterfall Calculation (Read-Only)
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-lg p-2 border text-center">
                                <p className="text-[9px] uppercase text-slate-400 font-bold">Student Paid</p>
                                <p className="text-sm font-black text-blue-700">{fmtUSD(entry.paymentFromStudent)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border text-center">
                                <p className="text-[9px] uppercase text-slate-400 font-bold">Tope Total Sup</p>
                                <p className="text-sm font-black text-slate-800">{fmtUSD(entry.supervisorCapTotal)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border text-center">
                                <p className="text-[9px] uppercase text-slate-400 font-bold">Remanente Prev</p>
                                <p className="text-sm font-black text-slate-800">{fmtUSD(entry.supervisorCapRemainingBefore)}</p>
                            </div>
                            <div className="bg-emerald-100 rounded-lg p-2 border border-emerald-200 text-center col-span-2">
                                <p className="text-[9px] uppercase text-emerald-600 font-bold">Calculated Payout</p>
                                <p className="text-lg font-black text-emerald-800">{fmtUSD(entry.supervisorPayout)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2 border text-center">
                                <p className="text-[9px] uppercase text-slate-400 font-bold">Nuevo Remanente</p>
                                <p className="text-sm font-black text-amber-700">{fmtUSD(entry.supervisorCapRemainingAfter)}</p>
                            </div>
                        </div>
                    </div>

                    {/* ── BLOQUE 3: MANUAL ── */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-3">
                        <p className="text-[10px] uppercase font-bold text-slate-600 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> Manual Details (Editable)
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Amount */}
                            <div className="space-y-1 col-span-2">
                                <Label className="text-xs font-semibold">Amount to Pay ($)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">$</span>
                                    <Input
                                        type="number" step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="pl-7"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Max: <span className="font-bold text-amber-600">{fmtUSD(entry.supervisorPayout)}</span>
                                </p>
                            </div>

                            {/* Method */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Payment Method</Label>
                                <Select value={method} onValueChange={setMethod}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ZELLE">Zelle</SelectItem>
                                        <SelectItem value="ACH">ACH Transfer</SelectItem>
                                        <SelectItem value="WIRE">Wire Transfer</SelectItem>
                                        <SelectItem value="CHECK">Physical Check</SelectItem>
                                        <SelectItem value="VENMO">Venmo</SelectItem>
                                        <SelectItem value="CASH">Cash</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Reference */}
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Reference / Confirmation #</Label>
                                <Input
                                    placeholder="e.g. Zelle Conf #12345"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                />
                            </div>

                            {/* Notes */}
                            <div className="space-y-1 col-span-2">
                                <Label className="text-xs font-semibold">Internal Notes (Optional)</Label>
                                <Textarea
                                    placeholder="Add any internal notes about this payment..."
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading} className="bg-amber-500 hover:bg-amber-600 text-white">
                        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Confirm Payment {fmtUSD(Number(amount))}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
