"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { approveSupervisionHour, rejectSupervisionHour, revertSupervisionHourToPending } from "@/actions/log-hours"
import { ArchiveRestore } from "lucide-react"

interface ReviewSupervisionLogActionsProps {
    logId: string
    status: string
    officeRole: string | null
}

export function ReviewSupervisionLogActions({ logId, status, officeRole }: ReviewSupervisionLogActionsProps) {
    const [isPending, startTransition] = useTransition()

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
        const reason = window.prompt("Enter rejection reason:")
        if (reason === null) return // cancelled

        startTransition(async () => {
            const res = await rejectSupervisionHour(logId, reason || "No reason provided")
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervision hour rejected")
            }
        })
    }

    const handleRevert = () => {
        if (!window.confirm("Are you sure you want to revert this log to PENDING? This will allow it to be reviewed again.")) return

        startTransition(async () => {
            const res = await revertSupervisionHourToPending(logId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Log reverted to Pending")
            }
        })
    }

    if (status === "REJECTED" && officeRole === "SUPER_ADMIN") {
        return (
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="text-warning hover:bg-warning/10 hover:text-warning border-warning/20"
                    onClick={handleRevert}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArchiveRestore className="h-4 w-4 mr-1" />}
                    Revert to Pending
                </Button>
            </div>
        )
    }

    if (status === "APPROVED") {
        return (
            <div className="flex justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                    onClick={handleReject}
                    disabled={isPending}
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                    Reject (Refund)
                </Button>
            </div>
        )
    }

    if (status !== "PENDING") {
        return null // Other statuses like BILLED don't have actions here currently
    }

    return (
        <div className="flex justify-end gap-2">
            <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20"
                onClick={handleReject}
                disabled={isPending}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                Reject
            </Button>
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
