"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Clock, Send, DollarSign, Loader2, ArrowRight, AlertCircle } from "lucide-react"
import { useState } from "react"
import { format } from "date-fns"
import { markInvoiceAsPaid, sendInvoice } from "@/actions/billing"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface InvoiceRow {
    id: string
    status: string
    invoiceDate: Date | string
    amountDue: number
    amountPaid: number
    student: { fullName: string; email: string }
    supervisionHours?: any[]
}

interface PaymentsTableProps {
    invoices: InvoiceRow[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    READY_TO_GO: { label: "Ready to Go", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle },
    SENT:        { label: "Sent",         color: "bg-amber-500/10 text-amber-600 border-amber-500/20",   icon: Clock },
    PARTIAL:     { label: "Partially Paid", color: "bg-blue-500/10 text-blue-600 border-blue-500/20",   icon: DollarSign },
    PAID:        { label: "Paid",          color: "bg-green-500/10 text-green-600 border-green-500/20",  icon: CheckCircle },
    OVERDUE:     { label: "Overdue",       color: "bg-red-500/10 text-red-600 border-red-500/20",         icon: AlertCircle },
}

export function PaymentsTable({ invoices }: PaymentsTableProps) {
    const router = useRouter()
    const [payInvoiceId, setPayInvoiceId]   = useState<string | null>(null)
    const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null)
    const [isPartial, setIsPartial]         = useState(false)
    const [amount, setAmount]               = useState("")
    const [method, setMethod]               = useState("ZELLE")
    const [loading, setLoading]             = useState(false)
    const [result, setResult]               = useState<{ supervisorPayout?: string; officePayout?: string } | null>(null)

    const selectedInvoice = invoices.find(i => i.id === payInvoiceId)

    // ── SEND HANDLER ─────────────────────────────────────────────────
    async function handleSend() {
        if (!sendInvoiceId) return
        setLoading(true)
        const res = await sendInvoice(sendInvoiceId)
        setLoading(false)
        if (res.success) {
            toast.success("Invoice sent ✓")
            setSendInvoiceId(null)
            router.refresh()
        } else {
            toast.error(res.error || "Error sending invoice")
        }
    }

    // ── PAY HANDLER ──────────────────────────────────────────────────
    async function handlePay() {
        if (!payInvoiceId || !amount) return
        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Invalid amount")
            return
        }
        if (selectedInvoice && numAmount > (selectedInvoice.amountDue - selectedInvoice.amountPaid)) {
            toast.error("Amount exceeds remaining balance")
            return
        }

        setLoading(true)
        const res = await markInvoiceAsPaid(payInvoiceId, numAmount, method)
        setLoading(false)

        if (res.success) {
            setResult({ supervisorPayout: res.supervisorPayout, officePayout: res.officePayout })
            toast.success(`Payment processed ✓ — Supervisor: $${res.supervisorPayout}, Office: $${res.officePayout}`)
            router.refresh()
        } else {
            toast.error(res.error || "Error processing payment")
        }
    }

    function openPayModal(inv: InvoiceRow) {
        setPayInvoiceId(inv.id)
        setIsPartial(false)
        setAmount((inv.amountDue - inv.amountPaid).toFixed(2))
        setResult(null)
    }

    function closePayModal() {
        setPayInvoiceId(null)
        setResult(null)
    }

    return (
        <div className="space-y-2">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground">Invoice</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground">Student</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground">Date</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground text-right">Total</TableHead>
                        <TableHead className="text-xs font-bold uppercase text-muted-foreground text-right">Balance</TableHead>
                        <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                No invoices in this state.
                            </TableCell>
                        </TableRow>
                    ) : invoices.map((inv) => {
                        const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.SENT
                        const Icon = cfg.icon
                        const balance = inv.amountDue - inv.amountPaid
                        const canSend = inv.status === "READY_TO_GO"
                        const canPay  = inv.status === "SENT" || inv.status === "PARTIAL"

                        return (
                            <TableRow key={inv.id}>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    #{inv.id.slice(-6).toUpperCase()}
                                </TableCell>
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-sm">{inv.student.fullName}</p>
                                        <p className="text-xs text-muted-foreground">{inv.student.email}</p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm">
                                    {format(new Date(inv.invoiceDate), "MMM d, yyyy")}
                                </TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold ${cfg.color}`}>
                                        <Icon className="h-3 w-3" />
                                        {cfg.label}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    ${inv.amountDue.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <span className={balance > 0 ? "text-amber-600 font-semibold" : "text-green-600"}>
                                        ${balance.toFixed(2)}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {/* SEND BUTTON */}
                                        {canSend && (
                                            <Dialog
                                                open={sendInvoiceId === inv.id}
                                                onOpenChange={v => v ? setSendInvoiceId(inv.id) : setSendInvoiceId(null)}
                                            >
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline" className="rounded-lg gap-1.5 text-xs">
                                                        <Send className="h-3 w-3" /> Send
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Send Invoice to {inv.student.fullName}?</DialogTitle>
                                                    </DialogHeader>
                                                    <p className="text-sm text-muted-foreground py-2">
                                                        Invoice #{inv.id.slice(-6).toUpperCase()} for <strong>${inv.amountDue.toFixed(2)}</strong> will be marked as SENT.
                                                    </p>
                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={() => setSendInvoiceId(null)}>Cancel</Button>
                                                        <Button onClick={handleSend} disabled={loading}>
                                                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                                            Confirm Send
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}

                                        {/* PAY BUTTON */}
                                        {canPay && (
                                            <Dialog open={payInvoiceId === inv.id} onOpenChange={v => v ? openPayModal(inv) : closePayModal()}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" className="rounded-lg gap-1.5 text-xs bg-primary">
                                                        <DollarSign className="h-3 w-3" /> Pay
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>Process Payment</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-5 py-4">
                                                        {/* Invoice Summary */}
                                                        <div className="bg-muted/40 rounded-xl p-4 space-y-1.5 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Student</span>
                                                                <span className="font-medium">{inv.student.fullName}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Invoice Total</span>
                                                                <span className="font-semibold">${inv.amountDue.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Already Paid</span>
                                                                <span className="text-green-600">${inv.amountPaid.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t border-border pt-1.5">
                                                                <span className="font-semibold">Remaining Balance</span>
                                                                <span className="font-bold text-amber-600">${(inv.amountDue - inv.amountPaid).toFixed(2)}</span>
                                                            </div>
                                                        </div>

                                                        {/* Payment Type Toggle */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => { setIsPartial(false); setAmount((inv.amountDue - inv.amountPaid).toFixed(2)) }}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                                                            >
                                                                Full Balance
                                                            </button>
                                                            <button
                                                                onClick={() => { setIsPartial(true); setAmount("") }}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                                                            >
                                                                Partial Amount
                                                            </button>
                                                        </div>

                                                        {/* Amount Input */}
                                                        <div className="space-y-1.5">
                                                            <Label>Amount to Record</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={amount}
                                                                onChange={e => setAmount(e.target.value)}
                                                                readOnly={!isPartial}
                                                                className={!isPartial ? "bg-muted cursor-not-allowed" : ""}
                                                                placeholder="Enter amount..."
                                                            />
                                                        </div>

                                                        {/* Method Select */}
                                                        <div className="space-y-1.5">
                                                            <Label>Payment Method</Label>
                                                            <Select value={method} onValueChange={setMethod}>
                                                                <SelectTrigger className="rounded-xl">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {["ZELLE","CHECK","VENMO","CASHAPP","CASH","PAYPAL","BANK_TRANSFER"].map(m => (
                                                                        <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Waterfall Preview */}
                                                        {amount && Number(amount) > 0 && (
                                                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-1 text-xs">
                                                                <p className="font-semibold text-primary mb-2">Waterfall Preview</p>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Max to Supervisor (50%)</span>
                                                                    <span className="font-medium">${(Number(amount) * 0.5).toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Min to Office (50%)</span>
                                                                    <span className="font-medium">${(Number(amount) * 0.5).toFixed(2)}</span>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground pt-1">* Exact split calculated by server, applying supervisor cap.</p>
                                                            </div>
                                                        )}

                                                        {/* Result after payment */}
                                                        {result && (
                                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 space-y-1 text-xs">
                                                                <p className="font-semibold text-green-600">Payment Registered ✓</p>
                                                                <div className="flex justify-between">
                                                                    <span>Supervisor received</span>
                                                                    <span className="font-bold">${result.supervisorPayout}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>Office received</span>
                                                                    <span className="font-bold">${result.officePayout}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={closePayModal}>Cancel</Button>
                                                        <Button onClick={handlePay} disabled={loading || !amount}>
                                                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                                            Confirm Payment
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
