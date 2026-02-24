"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Eye, Clock, Calendar, AlertCircle } from "lucide-react"
import { format } from "date-fns"

interface HourDetailsDialogProps {
    hour: any
}

export function HourDetailsDialog({ hour }: HourDetailsDialogProps) {
    if (!hour) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <div><Eye className="h-4 w-4" /></div>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Hour Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-lg">{hour.type === 'supervised' ? 'Supervised Hours' : 'Independent Hours'}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${hour.status === 'approved'
                            ? 'bg-success/10 text-success'
                            : hour.status === 'pending'
                                ? 'bg-warning/10 text-warning'
                                : hour.status === 'rejected'
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-muted text-muted-foreground'
                            }`}>
                            {hour.status?.toUpperCase() || 'LOGGED'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> Date
                            </span>
                            <p className="font-medium">{format(new Date(hour.date), 'MMMM d, yyyy')}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Time / Duration
                            </span>
                            <p className="font-medium">
                                {format(new Date(hour.startTime), 'h:mm a')} <span className="text-muted-foreground">({Number(hour.hours).toFixed(1)}h)</span>
                            </p>
                        </div>
                        {hour.type === 'supervised' && hour.supervisor && (
                            <div className="col-span-2 space-y-1">
                                <span className="text-muted-foreground">Supervisor</span>
                                <p className="font-medium">{hour.supervisor.fullName}</p>
                            </div>
                        )}
                        <div className="space-y-1">
                            <span className="text-muted-foreground">Activity Type</span>
                            <p className="font-medium capitalize">{hour.activityType?.toLowerCase().replace('_', ' ') || 'N/A'}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground">Setting</span>
                            <p className="font-medium capitalize">{hour.setting?.toLowerCase().replace('_', ' ') || 'N/A'}</p>
                        </div>
                        {hour.type === 'supervised' && (
                            <div className="space-y-1">
                                <span className="text-muted-foreground">Format</span>
                                <p className="font-medium capitalize">{hour.supervisionType?.toLowerCase() || 'N/A'}</p>
                            </div>
                        )}
                    </div>

                    {(hour.notes || hour.groupTopic) && (
                        <div className="space-y-1 pt-2 border-t mt-4">
                            <span className="text-sm text-muted-foreground">Notes</span>
                            <p className="text-sm bg-muted/50 p-3 rounded-md">{hour.notes || hour.groupTopic}</p>
                        </div>
                    )}

                    {hour.status === 'rejected' && hour.rejectReason && (
                        <div className="space-y-1 pt-2 border-t mt-4">
                            <span className="text-sm text-destructive flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Rejection Reason
                            </span>
                            <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">{hour.rejectReason}</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
