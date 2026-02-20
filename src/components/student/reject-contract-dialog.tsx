"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, XCircle } from "lucide-react"
import { rejectContract } from "@/actions/contracts"

interface RejectDialogProps {
    contractId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RejectContractDialog({ contractId, open, onOpenChange }: RejectDialogProps) {
    const [reason, setReason] = useState("")
    const [pending, startTransition] = useTransition()

    function handleSubmit() {
        if (!reason.trim()) return
        startTransition(async () => {
            await rejectContract(contractId, reason)
            onOpenChange(false)
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reject Contract</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                        Please provide a reason for rejecting this contract. This will be sent back to the office for review.
                    </p>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="e.g. The effective date is incorrect..."
                        className="w-full min-h-[100px] p-3 text-sm rounded-md border bg-background"
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button variant="destructive" onClick={handleSubmit} disabled={pending || !reason.trim()}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Reject
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
