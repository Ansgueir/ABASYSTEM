"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function SupervisorSessionsList({ hours }: { hours: any[] }) {
    const [selectedHour, setSelectedHour] = useState<string | null>(null)

    return (
        <div className="space-y-3">
            {hours.map((hour) => (
                <Dialog key={hour.id} open={selectedHour === hour.id} onOpenChange={(v) => setSelectedHour(v ? hour.id : null)}>
                    <DialogTrigger asChild>
                        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-10 w-10 border-2 border-primary/20">
                                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                        {hour.student?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                    <p className="font-medium">{hour.student?.fullName || 'Student'}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(hour.date), 'MMM d, yyyy')}
                                        {hour.activityType && <span> &bull; {hour.activityType}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold">{Number(hour.hours).toFixed(1)}h</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${hour.status === 'APPROVED' || hour.status === 'BILLED' || hour.status === 'PAID'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-warning/10 text-warning'
                                    }`}>
                                    {hour.status || 'PENDING'}
                                </span>
                            </div>
                        </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Session Detail - {format(new Date(hour.date), 'MMM d, yyyy')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="p-4 rounded-xl border bg-muted/20 text-sm">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1">Student</p>
                                        <p className="font-medium">{hour.student?.fullName || 'Unknown'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-muted-foreground mb-1">Status</p>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${hour.status === 'APPROVED' || hour.status === 'BILLED' || hour.status === 'PAID'
                                            ? 'bg-success/10 text-success'
                                            : 'bg-warning/10 text-warning'
                                            }`}>
                                            {hour.status || 'PENDING'}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1">Activity</p>
                                        <p className="font-medium">{hour.activityType}</p>
                                        <p className="text-muted-foreground text-xs mt-1">Format: {hour.supervisionType}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold text-muted-foreground mb-1">Time & Duration</p>
                                        <p className="font-medium">{new Date(hour.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="text-muted-foreground text-xs mt-1">{Number(hour.hours).toFixed(1)} hrs</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="font-semibold text-muted-foreground mb-1">Setting</p>
                                        <p className="font-medium">{hour.setting?.replace('_', ' ') || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="border-t pt-4 space-y-3">
                                    {hour.notes && (
                                        <div>
                                            <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Session Notes</p>
                                            <p className="text-muted-foreground text-sm italic py-2 px-3 bg-muted/30 rounded-lg">&quot;{hour.notes}&quot;</p>
                                        </div>
                                    )}
                                    {hour.groupTopic && (
                                        <div>
                                            <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase tracking-wider">Group Topic</p>
                                            <p className="font-medium text-sm">{hour.groupTopic}</p>
                                        </div>
                                    )}
                                    {hour.rejectReason && (
                                        <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 mt-2">
                                            <p className="font-semibold text-destructive mb-1 text-xs uppercase tracking-wider">Rejection Reason</p>
                                            <p className="text-destructive/90 text-sm">{hour.rejectReason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            ))}
        </div>
    )
}
