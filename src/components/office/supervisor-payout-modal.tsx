"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useState } from "react"
import { recordSupervisorPayout } from "@/actions/billing"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

interface SupervisorPayoutModalProps {
    isOpen: boolean
    onClose: () => void
    invoiceId: string
    supervisorId: string
    supervisorName: string
    remainingBalance: number
}

export function SupervisorPayoutModal({
    isOpen,
    onClose,
    invoiceId,
    supervisorId,
    supervisorName,
    remainingBalance
}: SupervisorPayoutModalProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [amount, setAmount] = useState(remainingBalance.toFixed(2))
    const [method, setMethod] = useState("ZELLE")
    const [reference, setReference] = useState("")
    const [notes, setNotes] = useState("")

    async function handleSubmit() {
        const numAmount = Number(amount)
        if (isNaN(numAmount) || numAmount <= 0) {
            toast.error("Please enter a valid amount")
            return
        }

        if (numAmount > remainingBalance + 0.01) {
            toast.error("Amount exceeds the remaining balance owed to supervisor")
            return
        }

        setLoading(true)
        try {
            const res = await recordSupervisorPayout({
                invoiceId,
                supervisorId,
                amount: numAmount,
                method,
                reference,
                notes
            })

            if (res.success) {
                toast.success("Payout recorded successfully ✓")
                onClose()
                router.refresh()
            } else {
                toast.error(res.error || "Failed to record payout")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Record Supervisor Payout</DialogTitle>
                    <DialogDescription>
                        Payment for {supervisorName} regarding invoice #{invoiceId.slice(-6).toUpperCase()}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Amount */}
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Amount to Pay ($)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground flex justify-between">
                            <span>Max Payment:</span>
                            <span className="font-bold text-amber-600">${remainingBalance.toFixed(2)}</span>
                        </p>
                    </div>

                    {/* Method */}
                    <div className="grid gap-2">
                        <Label htmlFor="method">Payment Method</Label>
                        <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger id="method">
                                <SelectValue placeholder="Select method" />
                            </SelectTrigger>
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
                    <div className="grid gap-2">
                        <Label htmlFor="reference">Transaction / Reference ID</Label>
                        <Input
                            id="reference"
                            placeholder="e.g. Bank Confirmation #12345"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                        />
                    </div>

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add internal notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Record Payout
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
