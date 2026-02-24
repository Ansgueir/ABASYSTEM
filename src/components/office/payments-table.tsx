"use client"

import { Invoice, Student } from "@prisma/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, CheckCircle, Clock, AlertCircle, Loader2 } from "lucide-react"
import { useState } from "react"
import { format } from "date-fns"
import { markInvoiceAsPaid } from "@/actions/billing"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface PaymentsTableProps {
    invoices: (Invoice & { student: Student, supervisionHours?: any[] })[]
}

export function PaymentsTable({ invoices }: PaymentsTableProps) {
    const router = useRouter()
    const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null)
    const [amount, setAmount] = useState("")
    const [method, setMethod] = useState("CHECK")
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [logOpen, setLogOpen] = useState(false)
    const [selectedLogInvoice, setSelectedLogInvoice] = useState<string | null>(null)

    async function handlePayment() {
        if (!selectedInvoice || !amount) return

        const invoiceRecord = invoices.find(i => i.id === selectedInvoice)
        if (invoiceRecord && Number(amount) > Number(invoiceRecord.amountDue)) {
            toast.error("Amount paid cannot exceed total amount due")
            return
        }

        setLoading(true)
        const result = await markInvoiceAsPaid(selectedInvoice, Number(amount), method)
        setLoading(false)

        if (result.success) {
            setOpen(false)
            setSelectedInvoice(null)
            setAmount("")
            toast.success("Payment processed successfully")
            router.refresh()
        } else {
            toast.error("Error processing payment")
        }
    }

    return (
        <div className="space-y-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Invoice ID</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No invoices found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell className="font-medium text-xs font-mono">#{invoice.id.slice(-6).toUpperCase()}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{invoice.student.fullName}</span>
                                        <span className="text-xs text-muted-foreground">{invoice.student.email}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{format(new Date(invoice.invoiceDate), "MMM d, yyyy")}</TableCell>
                                <TableCell>
                                    <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                                        {invoice.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                    ${Number(invoice.amountDue).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Dialog open={logOpen && selectedLogInvoice === invoice.id} onOpenChange={(v) => {
                                            setLogOpen(v)
                                            if (v) setSelectedLogInvoice(invoice.id)
                                            else setSelectedLogInvoice(null)
                                        }}>
                                            <DialogTrigger asChild>
                                                <Button size="sm" variant="outline">Logs</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                                <DialogHeader>
                                                    <DialogTitle>Invoice #{invoice.id.slice(-6).toUpperCase()} Details</DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    {invoice.supervisionHours && invoice.supervisionHours.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {invoice.supervisionHours.map((hour: any) => (
                                                                <div key={hour.id} className="p-4 rounded-xl border bg-muted/20 text-sm">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div>
                                                                            <p className="font-semibold">{hour.activityType} <span className="font-normal text-muted-foreground">({hour.supervisionType})</span></p>
                                                                            <p className="text-muted-foreground text-xs">
                                                                                {hour.setting.replace('_', ' ')} &bull; {new Date(hour.date).toISOString().split('T')[0]} &bull; {new Date(hour.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </p>
                                                                            {hour.notes && <p className="text-muted-foreground text-xs italic mt-1">&quot;{hour.notes}&quot;</p>}
                                                                            {hour.groupTopic && <p className="text-muted-foreground text-xs mt-1">Topic: {hour.groupTopic}</p>}
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="font-medium">${Number(hour.amountBilled).toFixed(2)}</p>
                                                                            <p className="text-muted-foreground text-xs">{Number(hour.hours).toFixed(1)} hrs</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="mt-2 text-xs border-t pt-2 text-muted-foreground flex justify-between">
                                                                        <span>Reg. by: {hour.supervisor?.fullName || 'Unknown'}</span>
                                                                        <span>Status: <span className="text-success font-medium">{hour.status}</span></span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground text-center py-4">No detailed logs found for this invoice.</p>
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                        <a href={`/api/office/invoices/${invoice.id}/download`} target="_blank">
                                            <Button size="sm" variant="secondary">View</Button>
                                        </a>
                                        {invoice.status !== 'PAID' && (
                                            <Dialog open={open && selectedInvoice === invoice.id} onOpenChange={(v) => {
                                                setOpen(v)
                                                if (v) {
                                                    setSelectedInvoice(invoice.id)
                                                    setAmount(Number(invoice.amountDue).toFixed(2))
                                                } else {
                                                    setSelectedInvoice(null)
                                                }
                                            }}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline">Pay</Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Process Payment</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label>Amount</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={amount}
                                                                readOnly
                                                                className="bg-muted cursor-not-allowed"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Payment Method</Label>
                                                            <Select value={method} onValueChange={setMethod}>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="CHECK">Check</SelectItem>
                                                                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                                                                    <SelectItem value="CASH">Cash</SelectItem>
                                                                    <SelectItem value="STRIPE">Stripe</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                                        <Button onClick={handlePayment} disabled={loading}>
                                                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                            Confirm Payment
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
