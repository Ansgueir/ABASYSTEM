"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2, Eye, Shield, Users, Clock, Calendar, FileText } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { approveSupervisionHour, rejectSupervisionHour, revertSupervisionHourToPending } from "@/actions/log-hours"
import { ArchiveRestore } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ReviewSupervisionLogActionsProps {
    logId: string
    status: string
    officeRole: string | null
    logData?: any
}

export function ReviewSupervisionLogActions({ logId, status, officeRole, logData }: ReviewSupervisionLogActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
    const [revertDialogOpen, setRevertDialogOpen] = useState(false)
    const [approveDialogOpen, setApproveDialogOpen] = useState(false)
    const [rejectReason, setRejectReason] = useState("")

    const handleApprove = () => {
        startTransition(async () => {
            const res = await approveSupervisionHour(logId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervision hour approved")
                setApproveDialogOpen(false)
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

    // NEW: Dialog content for viewing details (shared logic)
    const renderViewDetails = () => (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Supervision Log Details
                    </DialogTitle>
                    <DialogDescription>
                        Full summary of the supervision session.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-muted/30 border">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Date</span>
                            <span className="font-semibold text-sm">
                                {logData?.date ? format(new Date(logData.date), "PPP") : "N/A"}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border">
                            <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider">Hours</span>
                            <span className="font-semibold text-sm">
                                {Number(logData?.hours || 0).toFixed(1)} hrs
                            </span>
                        </div>
                    </div>

                    {/* Session Data */}
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-card border shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Users className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Type & Setting</p>
                                <p className="text-sm font-medium">{logData?.supervisionType} • {logData?.setting?.replace(/_/g, ' ')}</p>
                            </div>
                        </div>

                        {logData?.groupTopic && (
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-card border shadow-sm">
                                <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4 text-secondary" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Group Topic</p>
                                    <p className="text-sm font-medium">{logData.groupTopic}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-start gap-3 p-3 rounded-xl bg-card border shadow-sm">
                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Time Interval</p>
                                <p className="text-sm font-medium">
                                    {logData?.startTime ? format(new Date(logData.startTime), "p") : "N/A"}
                                    {logData?.endTime ? ` - ${format(new Date(logData.endTime), "p")}` : ""}
                                </p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border space-y-2">
                            <p className="text-xs text-muted-foreground uppercase font-semibold">System IDs</p>
                            <div className="flex flex-col gap-1">
                                <span className="font-mono text-[9px] text-muted-foreground uppercase">Log: {logId}</span>
                                <span className="font-mono text-[9px] text-muted-foreground uppercase">Status: {status}</span>
                            </div>
                        </div>

                        {logData?.notes && (
                            <div className="space-y-2 pt-2">
                                <p className="text-xs text-muted-foreground uppercase font-semibold px-1">Session Notes</p>
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 italic text-sm text-foreground/80 leading-relaxed">
                                    "{logData.notes}"
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { }} className="w-full" asChild>
                        <Link href={`/office/supervision-logs`}>Close View</Link>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

    if (status === "REJECTED") {
        return (
            <div className="flex justify-end items-center gap-2">
                {renderViewDetails()}
                {officeRole === "SUPER_ADMIN" && (
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
                )}

                <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-success hover:bg-success/90 text-white"
                            disabled={isPending}
                        >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Approve Rejected Log</DialogTitle>
                            <DialogDescription>
                                You are about to approve a log that was previously rejected. This will calculate and apply the supervisor's payment for this hour and move the log to the APPROVED tab.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
                            <Button className="bg-success hover:bg-success/90 text-white" onClick={handleApprove} disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                Confirm Approval
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )
    }

    if (status === "APPROVED") {
        return (
            <div className="flex justify-end items-center gap-2">
                {renderViewDetails()}
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
        return (
            <div className="flex justify-end items-center gap-2">
                {renderViewDetails()}
            </div>
        )
    }

    return (
        <div className="flex justify-end items-center gap-2">
            {renderViewDetails()}
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
