"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, Clock, Send, DollarSign, Loader2, AlertCircle, FileText, Eye } from "lucide-react"
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
    // FIX #3: search is scoped externally — passed as filtered list already
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    READY_TO_GO: { label: "Ready to Go",    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle },
    SENT:        { label: "Sent",           color: "bg-amber-500/10 text-amber-600 border-amber-500/20",       icon: Clock },
    PARTIAL:     { label: "Partially Paid", color: "bg-blue-500/10 text-blue-600 border-blue-500/20",          icon: DollarSign },
    PAID:        { label: "Paid",           color: "bg-green-500/10 text-green-600 border-green-500/20",       icon: CheckCircle },
    OVERDUE:     { label: "Overdue",        color: "bg-red-500/10 text-red-600 border-red-500/20",             icon: AlertCircle },
}

export function PaymentsTable({ invoices }: PaymentsTableProps) {
    const router = useRouter()

    // Modal state — Pay
    const [payInvoiceId, setPayInvoiceId]   = useState<string | null>(null)
    const [isPartial, setIsPartial]         = useState(false)
    const [amount, setAmount]               = useState("")
    const [method, setMethod]               = useState("ZELLE")
    const [loading, setLoading]             = useState(false)
    const [result, setResult]               = useState<{ supervisorPayout?: string; officePayout?: string } | null>(null)

    // Modal state — Send
    const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null)

    // Modal state — Logs (FIX #1: hours detail)
    const [logsInvoiceId, setLogsInvoiceId] = useState<string | null>(null)

    const selectedInvoice  = invoices.find(i => i.id === payInvoiceId)
    const logsInvoice      = invoices.find(i => i.id === logsInvoiceId)

    // ── SEND HANDLER ──────────────────────────────────────────────────
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

    // ── PAY HANDLER ─────────────────────────────────────────────────
    // FIX #4 CONFIRMED: Pay button opens THIS modal, does NOT process instantly.
    async function handlePay() {
        if (!payInvoiceId || !amount) return
        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) { toast.error("Invalid amount"); return }
        if (selectedInvoice && numAmount > (selectedInvoice.amountDue - selectedInvoice.amountPaid) + 0.01) {
            toast.error("Amount exceeds remaining balance")
            return
        }
        setLoading(true)
        const res = await markInvoiceAsPaid(payInvoiceId, numAmount, method)
        setLoading(false)
        if (res.success) {
            setResult({ supervisorPayout: res.supervisorPayout, officePayout: res.officePayout })
            toast.success(`Payment recorded ✓ — Sup: $${res.supervisorPayout} · Office: $${res.officePayout}`)
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
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/60">
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground w-[80px]">Invoice</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Student</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground">Status</TableHead>
                        {/* FIX #2: Three separate financial columns */}
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground text-right">Total Amount</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground text-right">Paid Amount</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground text-right">Remaining Balance</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                                No invoices found.
                            </TableCell>
                        </TableRow>
                    ) : invoices.map((inv) => {
                        const cfg      = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.SENT
                        const Icon     = cfg.icon
                        const balance  = inv.amountDue - inv.amountPaid
                        const canSend  = inv.status === "READY_TO_GO"
                        const canPay   = inv.status === "SENT" || inv.status === "PARTIAL"

                        return (
                            <TableRow key={inv.id} className="group">

                                {/* Invoice ID */}
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                    #{inv.id.slice(-6).toUpperCase()}
                                </TableCell>

                                {/* Student */}
                                <TableCell>
                                    <p className="font-medium text-sm leading-tight">{inv.student.fullName}</p>
                                    <p className="text-[11px] text-muted-foreground">{inv.student.email}</p>
                                </TableCell>

                                {/* Date */}
                                <TableCell className="text-sm text-muted-foreground">
                                    {format(new Date(inv.invoiceDate), "MMM d, yyyy")}
                                </TableCell>

                                {/* Status Badge */}
                                <TableCell>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold whitespace-nowrap ${cfg.color}`}>
                                        <Icon className="h-3 w-3 shrink-0" />
                                        {cfg.label}
                                    </span>
                                </TableCell>

                                {/* FIX #2: Total Amount */}
                                <TableCell className="text-right font-semibold text-sm">
                                    ${inv.amountDue.toFixed(2)}
                                </TableCell>

                                {/* FIX #2: Paid Amount */}
                                <TableCell className="text-right text-sm">
                                    <span className={inv.amountPaid > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                        ${inv.amountPaid.toFixed(2)}
                                    </span>
                                </TableCell>

                                {/* FIX #2: Remaining Balance */}
                                <TableCell className="text-right text-sm">
                                    <span className={balance > 0.01 ? "text-amber-600 font-semibold" : "text-green-600 font-semibold"}>
                                        ${balance.toFixed(2)}
                                    </span>
                                </TableCell>

                                {/* FIX #1: ALL 3 action buttons in every row */}
                                <TableCell className="text-right">
                                    <div className="flex justify-end items-center gap-1.5">

                                        {/* ── LOGS BUTTON (all states) ── */}
                                        <Dialog
                                            open={logsInvoiceId === inv.id}
                                            onOpenChange={v => setLogsInvoiceId(v ? inv.id : null)}
                                        >
                                            <DialogTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground">
                                                    <FileText className="h-3.5 w-3.5" /> Logs
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Invoice #{inv.id.slice(-6).toUpperCase()} — {inv.student.fullName}
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-3 py-2">
                                                    {logsInvoice?.supervisionHours && logsInvoice.supervisionHours.length > 0 ? (
                                                        logsInvoice.supervisionHours.map((h: any) => (
                                                            <div key={h.id} className="p-4 rounded-xl border bg-muted/20 text-sm">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <p className="font-semibold">{h.activityType} <span className="font-normal text-muted-foreground">({h.supervisionType})</span></p>
                                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                            {h.setting?.replace('_', ' ')} &bull; {new Date(h.date).toISOString().split('T')[0]} &bull; {new Date(h.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </p>
                                                                        {h.supervisor?.fullName && (
                                                                            <p className="text-[11px] text-muted-foreground">Supervisor: {h.supervisor.fullName}</p>
                                                                        )}
                                                                        {h.notes && <p className="text-[11px] italic text-muted-foreground mt-1">"{h.notes}"</p>}
                                                                    </div>
                                                                    <div className="text-right shrink-0 ml-4">
                                                                        <p className="font-semibold">${Number(h.amountBilled || 0).toFixed(2)}</p>
                                                                        <p className="text-[11px] text-muted-foreground">{Number(h.hours).toFixed(1)} hrs</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground text-center py-8">
                                                            No detailed logs found for this invoice.
                                                        </p>
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>

                                        {/* ── VIEW BUTTON (all states) ── */}
                                        <a href={`/api/office/invoices/${inv.id}/download`} target="_blank" rel="noopener noreferrer">
                                            <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs gap-1 text-muted-foreground hover:text-foreground">
                                                <Eye className="h-3.5 w-3.5" /> View
                                            </Button>
                                        </a>

                                        {/* ── SEND BUTTON (only READY_TO_GO) ── */}
                                        {canSend && (
                                            <Dialog
                                                open={sendInvoiceId === inv.id}
                                                onOpenChange={v => v ? setSendInvoiceId(inv.id) : setSendInvoiceId(null)}
                                            >
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1 rounded-lg">
                                                        <Send className="h-3.5 w-3.5" /> Send
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Send Invoice to {inv.student.fullName}?</DialogTitle>
                                                    </DialogHeader>
                                                    <p className="text-sm text-muted-foreground py-2">
                                                        Invoice #{inv.id.slice(-6).toUpperCase()} for <strong>${inv.amountDue.toFixed(2)}</strong> will be marked as <strong>SENT</strong>.
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

                                        {/* ── PAY BUTTON (SENT / PARTIAL only) — opens modal, NOT instant ── */}
                                        {canPay && (
                                            <Dialog open={payInvoiceId === inv.id} onOpenChange={v => v ? openPayModal(inv) : closePayModal()}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" className="h-7 px-2.5 text-xs gap-1 rounded-lg">
                                                        <DollarSign className="h-3.5 w-3.5" /> Pay
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>Process Payment — {inv.student.fullName}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-5 py-3">

                                                        {/* Invoice Summary */}
                                                        <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Invoice Total</span>
                                                                <span className="font-semibold">${inv.amountDue.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-muted-foreground">Already Paid</span>
                                                                <span className="text-green-600 font-medium">${inv.amountPaid.toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t border-border pt-2">
                                                                <span className="font-semibold">Remaining Balance</span>
                                                                <span className="font-bold text-amber-600">${(inv.amountDue - inv.amountPaid).toFixed(2)}</span>
                                                            </div>
                                                        </div>

                                                        {/* FIX #4: Full / Partial toggle */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => { setIsPartial(false); setAmount((inv.amountDue - inv.amountPaid).toFixed(2)) }}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                            >
                                                                Full Balance
                                                            </button>
                                                            <button
                                                                onClick={() => { setIsPartial(true); setAmount("") }}
                                                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                                                            >
                                                                Other Amount
                                                            </button>
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label>Amount to Record</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={amount}
                                                                onChange={e => setAmount(e.target.value)}
                                                                readOnly={!isPartial}
                                                                className={`rounded-xl ${!isPartial ? "bg-muted/60 cursor-not-allowed text-muted-foreground" : ""}`}
                                                                placeholder={isPartial ? "Enter partial amount..." : ""}
                                                            />
                                                        </div>

                                                        <div className="space-y-1.5">
                                                            <Label>Payment Method</Label>
                                                            <Select value={method} onValueChange={setMethod}>
                                                                <SelectTrigger className="rounded-xl">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {["ZELLE","CHECK","VENMO","CASHAPP","CASH","PAYPAL","BANK_TRANSFER","CREDIT_CARD"].map(m => (
                                                                        <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* Waterfall Preview */}
                                                        {amount && Number(amount) > 0 && !result && (
                                                            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-1.5 text-xs">
                                                                <p className="font-semibold text-primary">Waterfall Distribution Preview</p>
                                                                <div className="flex justify-between text-muted-foreground">
                                                                    <span>Max to Supervisor (50% cap)</span>
                                                                    <span className="font-medium text-foreground">${(Number(amount) * 0.5).toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-muted-foreground">
                                                                    <span>Min to Office</span>
                                                                    <span className="font-medium text-foreground">${(Number(amount) * 0.5).toFixed(2)}</span>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground pt-0.5">* Exact split calculated by engine after applying supervisor cap.</p>
                                                            </div>
                                                        )}

                                                        {/* Post-payment result */}
                                                        {result && (
                                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 space-y-1.5 text-xs">
                                                                <p className="font-semibold text-green-600">Payment Registered ✓</p>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Supervisor received</span>
                                                                    <span className="font-bold">${result.supervisorPayout}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-muted-foreground">Office received</span>
                                                                    <span className="font-bold">${result.officePayout}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={closePayModal}>
                                                            {result ? "Close" : "Cancel"}
                                                        </Button>
                                                        {!result && (
                                                            <Button onClick={handlePay} disabled={loading || !amount}>
                                                                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                                                Confirm Payment
                                                            </Button>
                                                        )}
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
