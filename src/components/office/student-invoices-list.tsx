"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    CheckCircle, Clock, AlertCircle, Send, DollarSign, FileText, Eye,
    ChevronDown, ChevronUp, Loader2, Users
} from "lucide-react"
import { format } from "date-fns"
import { markInvoiceAsPaid, sendInvoice } from "@/actions/billing"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceRow {
    id: string
    status: string
    invoiceDate: Date | string
    amountDue: number
    amountPaid: number
    student: { id: string; fullName: string; email: string }
    supervisionHours?: any[]
}

interface StudentGroup {
    studentId: string
    fullName: string
    email: string
    contractTotal: number   // from plan.totalCost
    totalBilled: number     // sum of all amountDue
    totalPaid: number       // sum of all amountPaid
    invoices: InvoiceRow[]
}

interface StudentInvoicesListProps {
    studentGroups: StudentGroup[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtUSD = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtDate = (d: Date | string) =>
    format(new Date(d), "MMM d, yyyy")

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    READY_TO_GO: { label: "Ready to Go", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle },
    SENT:        { label: "Sent",        color: "bg-amber-500/10 text-amber-600 border-amber-500/20",       icon: Clock },
    PAID:        { label: "Paid",        color: "bg-green-500/10 text-green-600 border-green-500/20",       icon: CheckCircle },
    OVERDUE:     { label: "Overdue",     color: "bg-red-500/10 text-red-600 border-red-500/20",             icon: AlertCircle },
}

// ─── Sub-component: Single Invoice Row ───────────────────────────────────────

function InvoiceRow({ inv, isPaidSection }: { inv: InvoiceRow; isPaidSection: boolean }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [logsOpen, setLogsOpen] = useState(false)
    const [sendOpen, setSendOpen] = useState(false)
    const [payOpen, setPayOpen] = useState(false)
    const [isPartial, setIsPartial] = useState(false)
    const [amount, setAmount] = useState((inv.amountDue - inv.amountPaid).toFixed(2))
    const [method, setMethod] = useState("ZELLE")
    const [result, setResult] = useState<{ supervisorPayout?: string; officePayout?: string } | null>(null)

    const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.SENT
    const Icon = cfg.icon
    const balance = inv.amountDue - inv.amountPaid
    const canSend = inv.status === "READY_TO_GO"
    const canPay  = inv.status === "SENT"

    async function handleSend() {
        setLoading(true)
        const res = await sendInvoice(inv.id)
        setLoading(false)
        if (res.success) { toast.success("Invoice sent ✓"); setSendOpen(false); router.refresh() }
        else toast.error(res.error || "Error sending")
    }

    async function handlePay() {
        const num = Number(amount)
        if (isNaN(num) || num <= 0) { toast.error("Invalid amount"); return }
        if (num > balance + 0.01)   { toast.error("Exceeds remaining balance"); return }
        setLoading(true)
        const res = await markInvoiceAsPaid(inv.id, num, method)
        setLoading(false)
        if (res.success) {
            setResult({ supervisorPayout: res.supervisorPayout, officePayout: res.officePayout })
            toast.success(`Payment recorded ✓`)
            router.refresh()
        } else {
            toast.error(res.error || "Error processing payment")
        }
    }

    return (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
            isPaidSection
                ? "bg-muted/20 border-muted"
                : inv.status === "READY_TO_GO"
                    ? "bg-emerald-50/60 border-emerald-200"
                    : "bg-amber-50/60 border-amber-200"
        }`}>
            {/* Left: Invoice info */}
            <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                    #{inv.id.slice(-6).toUpperCase()}
                </span>
                <div>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(inv.invoiceDate)}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${cfg.color}`}>
                        <Icon className="h-2.5 w-2.5" /> {cfg.label}
                    </span>
                </div>
            </div>

            {/* Center: Amounts */}
            <div className="flex items-center gap-5 text-sm">
                <div className="text-center">
                    <p className="text-[9px] uppercase text-slate-400 font-bold">Invoice</p>
                    <p className="font-semibold text-slate-800">{fmtUSD(inv.amountDue)}</p>
                </div>
                <div className="text-center">
                    <p className="text-[9px] uppercase text-slate-400 font-bold">Paid</p>
                    <p className={`font-semibold ${inv.amountPaid > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                        {fmtUSD(inv.amountPaid)}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-[9px] uppercase text-slate-400 font-bold">Balance</p>
                    <p className={`font-bold ${balance > 0.01 ? "text-amber-600" : "text-green-600"}`}>
                        {fmtUSD(balance)}
                    </p>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Logs */}
                <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" /> Logs
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Invoice #{inv.id.slice(-6).toUpperCase()} — Logged Hours</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 py-2">
                            {inv.supervisionHours && inv.supervisionHours.length > 0 ? (
                                inv.supervisionHours.map((h: any) => (
                                    <div key={h.id} className="p-4 rounded-xl border bg-muted/20 text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{h.activityType} <span className="font-normal text-muted-foreground">({h.supervisionType})</span></p>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {h.setting?.replace("_", " ")} &bull; {new Date(h.date).toISOString().split("T")[0]} &bull; {new Date(h.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </p>
                                                {h.supervisor?.fullName && <p className="text-[11px] text-muted-foreground">Supervisor: {h.supervisor.fullName}</p>}
                                                {h.notes && <p className="text-[11px] italic text-muted-foreground mt-1">&ldquo;{h.notes}&rdquo;</p>}
                                            </div>
                                            <div className="text-right shrink-0 ml-4">
                                                <p className="font-semibold">${Number(h.amountBilled || 0).toFixed(2)}</p>
                                                <p className="text-[11px] text-muted-foreground">{Number(h.hours).toFixed(1)} hrs</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground text-center py-8">No detailed logs for this invoice.</p>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* View PDF */}
                <a href={`/api/office/invoices/${inv.id}/download`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                </a>

                {/* Send */}
                {canSend && (
                    <Dialog open={sendOpen} onOpenChange={setSendOpen}>
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
                                Invoice #{inv.id.slice(-6).toUpperCase()} for <strong>{fmtUSD(inv.amountDue)}</strong> will be marked as <strong>SENT</strong>.
                            </p>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                                <Button onClick={handleSend} disabled={loading}>
                                    {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                    Confirm Send
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                {/* Pay */}
                {canPay && (
                    <Dialog open={payOpen} onOpenChange={v => { setPayOpen(v); if (!v) setResult(null) }}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="h-7 px-2.5 text-xs gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white">
                                <DollarSign className="h-3.5 w-3.5" /> Pay
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Process Payment — {inv.student.fullName}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                {/* Summary */}
                                <div className="bg-muted/40 rounded-xl p-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Invoice Total</span>
                                        <span className="font-semibold">{fmtUSD(inv.amountDue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Already Paid</span>
                                        <span className="text-green-600 font-medium">{fmtUSD(inv.amountPaid)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-border pt-2">
                                        <span className="font-semibold">Remaining Balance</span>
                                        <span className="font-bold text-amber-600">{fmtUSD(balance)}</span>
                                    </div>
                                </div>
                                {/* Full / Partial */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setIsPartial(false); setAmount(balance.toFixed(2)) }}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${!isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                                    >Full Balance</button>
                                    <button
                                        onClick={() => { setIsPartial(true); setAmount("") }}
                                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${isPartial ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                                    >Other Amount</button>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Amount to Record</Label>
                                    <Input
                                        type="number" step="0.01" min="0.01"
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
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {["ZELLE","CHECK","VENMO","CASHAPP","CASH","PAYPAL","BANK_TRANSFER","CREDIT_CARD"].map(m => (
                                                <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Waterfall preview */}
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
                                {/* Post-pay result */}
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
                                <Button variant="outline" onClick={() => { setPayOpen(false); setResult(null) }}>
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
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StudentInvoicesList({ studentGroups }: StudentInvoicesListProps) {
    const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({})

    if (studentGroups.length === 0) {
        return (
            <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No student invoices found.</p>
                    <p className="text-sm mt-1">Invoices appear here after running the billing engine.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {studentGroups.map(group => {
                const isExpanded = expandedStudents[group.studentId] !== false  // default expanded
                const pending  = group.invoices.filter(i => i.status !== "PAID")
                const paid     = group.invoices.filter(i => i.status === "PAID")
                const remaining = group.totalBilled - group.totalPaid
                const contractRemaining = group.contractTotal > 0 ? group.contractTotal - group.totalPaid : null

                return (
                    <Card key={group.studentId} className="overflow-hidden">
                        {/* ── Student Header ── */}
                        <div
                            className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedStudents(p => ({ ...p, [group.studentId]: !isExpanded }))}
                        >
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                                    {group.fullName.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-tight">{group.fullName}</h3>
                                    <p className="text-xs text-muted-foreground">{group.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-5">
                                {/* Summary pills */}
                                <div className="hidden sm:flex items-center gap-4 text-right">
                                    {group.contractTotal > 0 && (
                                        <div>
                                            <p className="text-[10px] uppercase text-slate-400 font-bold">Contract</p>
                                            <p className="text-sm font-black text-slate-700">{fmtUSD(group.contractTotal)}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[10px] uppercase text-slate-400 font-bold">Billed</p>
                                        <p className="text-sm font-black text-blue-700">{fmtUSD(group.totalBilled)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-green-600 font-bold">Collected</p>
                                        <p className="text-sm font-black text-green-700">{fmtUSD(group.totalPaid)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase text-amber-600 font-bold">Pending</p>
                                        <p className="text-sm font-black text-amber-700">{fmtUSD(remaining)}</p>
                                    </div>
                                    {contractRemaining !== null && contractRemaining > 0.01 && (
                                        <div>
                                            <p className="text-[10px] uppercase text-red-500 font-bold">Contract Rem.</p>
                                            <p className="text-sm font-black text-red-600">{fmtUSD(contractRemaining)}</p>
                                        </div>
                                    )}
                                </div>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        </div>

                        {/* ── Expandable Body ── */}
                        {isExpanded && (
                            <CardContent className="px-4 pb-4 pt-0 space-y-4">

                                {/* Mobile summary strip */}
                                <div className="sm:hidden flex flex-wrap gap-3 text-sm bg-muted/30 rounded-xl p-3">
                                    {group.contractTotal > 0 && <div><span className="text-muted-foreground text-xs">Contract: </span><span className="font-bold">{fmtUSD(group.contractTotal)}</span></div>}
                                    <div><span className="text-muted-foreground text-xs">Billed: </span><span className="font-bold text-blue-700">{fmtUSD(group.totalBilled)}</span></div>
                                    <div><span className="text-muted-foreground text-xs">Paid: </span><span className="font-bold text-green-700">{fmtUSD(group.totalPaid)}</span></div>
                                    <div><span className="text-muted-foreground text-xs">Pending: </span><span className="font-bold text-amber-700">{fmtUSD(remaining)}</span></div>
                                </div>

                                {/* ── Pending/Active Invoices ── */}
                                {pending.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-amber-600 flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> Pending / Active ({pending.length})
                                        </p>
                                        {pending.map(inv => (
                                            <InvoiceRow key={inv.id} inv={inv} isPaidSection={false} />
                                        ))}
                                    </div>
                                )}

                                {/* ── Paid Invoices ── */}
                                {paid.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-green-600 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> Payment History ({paid.length})
                                        </p>
                                        {paid.map(inv => (
                                            <InvoiceRow key={inv.id} inv={inv} isPaidSection={true} />
                                        ))}
                                    </div>
                                )}

                                {/* ── Contract Grand Total Footer ── */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-wrap gap-4 justify-between text-sm">
                                    <p className="text-[10px] uppercase font-bold text-slate-500 self-center">Contract Summary</p>
                                    <div className="flex flex-wrap gap-5">
                                        {group.contractTotal > 0 && (
                                            <div className="text-center">
                                                <p className="text-[9px] uppercase text-slate-400 font-bold">Contract Total</p>
                                                <p className="font-black text-slate-700">{fmtUSD(group.contractTotal)}</p>
                                            </div>
                                        )}
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase text-slate-400 font-bold">Total Billed</p>
                                            <p className="font-black text-blue-700">{fmtUSD(group.totalBilled)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase text-green-600 font-bold">Total Collected</p>
                                            <p className="font-black text-green-700">{fmtUSD(group.totalPaid)}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[9px] uppercase text-amber-600 font-bold">Still Pending</p>
                                            <p className="font-black text-amber-700">{fmtUSD(remaining)}</p>
                                        </div>
                                        {contractRemaining !== null && (
                                            <div className="text-center">
                                                <p className="text-[9px] uppercase text-red-500 font-bold">Contract Remaining</p>
                                                <p className={`font-black ${contractRemaining > 0.01 ? "text-red-600" : "text-green-600"}`}>
                                                    {contractRemaining > 0.01 ? fmtUSD(contractRemaining) : "✓ Fully Paid"}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </CardContent>
                        )}
                    </Card>
                )
            })}
        </div>
    )
}
