"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { approveSupervisionHour, rejectSupervisionHour } from "@/actions/log-hours"

interface ReviewSupervisionLogActionsProps {
    logId: string
}

export function ReviewSupervisionLogActions({ logId }: ReviewSupervisionLogActionsProps) {
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
