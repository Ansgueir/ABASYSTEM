"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { approveSupervisionHour, rejectSupervisionHour, revertSupervisionHourToPending } from "@/actions/log-hours"
import { ArchiveRestore } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ReviewSupervisionLogActionsProps {
    logId: string
    status: string
    officeRole: string | null
}

export function ReviewSupervisionLogActions({ logId, status, officeRole }: ReviewSupervisionLogActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [revertDialogOpen, setRevertDialogOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState("")

    const handleApprove = () => {
        startTransition(async () => {
            const res = await approveSupervisionHour(logId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervision hour approved")
            }
        })
    }

    const handleReject = () => {
        if (!rejectReason.trim()) return

        startTransition(async () => {
            const res = await rejectSupervisionHour(logId, rejectReason || "No reason provided")
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervision hour rejected")
                setRejectDialogOpen(false)
                setRejectReason("")
            }
        })
    }

    const handleRevert = () => {
        startTransition(async () => {
            const res = await revertSupervisionHourToPending(logId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Log reverted to Pending")
                setRevertDialogOpen(false)
            }
        })
    }

    if (status === "REJECTED" && officeRole === "SUPER_ADMIN") {
        return (
            <div className="flex justify-end gap-2">
                <Dialog open={revertDialogOpen} onOpenChange={setRevertDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-warning hover:bg-warning/10 hover:text-warning border-warning/20"
                            disabled={isPending}
                        >
                            <ArchiveRestore className="h-4 w-4 mr-1" />
                            Revert to Pending
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Revert Log</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to revert this log to PENDING? This will allow it to be reviewed again.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleRevert} disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                                Revert
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    if (status === "APPROVED") {
        return (
            <div className="flex justify-end gap-2">
                <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                            disabled={isPending}
                        >
                            <X className="h-4 w-4 mr-1" />
                            Reject (Refund)
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Log</DialogTitle>
                            <DialogDescription>
                                This will redund the payment to the supervisor and move the log to the REJECTED tab.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="reason">Rejection Reason</Label>
                            <Input
                                id="reason"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Why is this log being rejected?"
                            />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleReject} disabled={isPending || !rejectReason.trim()}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                                Reject Log
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    if (status !== "PENDING") {
        return null // Other statuses like BILLED don't have actions here currently
    }

    return (
        <div className="flex justify-end gap-2">
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                        disabled={isPending}
                    >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Supervision Hour</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for rejecting this log. The student will be able to see this.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="reason2">Rejection Reason</Label>
                        <Input
                            id="reason2"
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Type the reason..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject} disabled={isPending || !rejectReason.trim()}>
                            {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                            Confirm Rejection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Button
                variant="default"
                size="sm"
                className="bg-success hover:bg-success/90 text-white"
                onClick={handleApprove}
                disabled={isPending}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Approve
            </Button>
        </div>
    )
}
