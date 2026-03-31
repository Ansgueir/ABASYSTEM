"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"

export function StudentActivityTab({ supervisionHours = [], independentHours = [] }: { supervisionHours: any[], independentHours: any[] }) {
    const [mounted, setMounted] = useState(false)
    const [selectedHour, setSelectedHour] = useState<any>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground">Loading activity history...</div>
    }

    const safeSupervision = Array.isArray(supervisionHours) ? supervisionHours : []
    const safeIndependent = Array.isArray(independentHours) ? independentHours : []

    const allHours = [...safeSupervision, ...safeIndependent]
        .filter((h: any) => h && (h.status === "APPROVED" || h.status === "BILLED" || h.status === "PENDING" || h.status === "REJECTED"))

    return (
        <div className="rounded-xl border bg-card p-6 w-full overflow-x-auto relative mt-6">
            <h3 className="font-semibold text-lg mb-4">Activity Log Calendar</h3>
            <div className="w-full relative">
                <TimesheetCalendar 
                    hours={allHours} 
                    role="student" 
                    onEventClick={(hour: any) => setSelectedHour(hour)} 
                />
            </div>

            <Dialog open={!!selectedHour} onOpenChange={(open: boolean) => !open && setSelectedHour(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Activity Details</DialogTitle>
                    </DialogHeader>
                    {selectedHour && (
                        <div className="space-y-4 py-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-muted-foreground text-xs">Date</p>
                                    <p className="font-medium">
                                        {format(new Date(selectedHour.date || selectedHour.startTime || new Date()), "MMMM d, yyyy")}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Duration</p>
                                    <p className="font-medium">
                                        {Number(selectedHour.hours || 0).toFixed(1)} hrs
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Type</p>
                                    <p className="font-medium">
                                        {('supervisionType' in selectedHour || 'supervisorId' in selectedHour) ? 'Supervised' : 'Independent'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs">Status</p>
                                    <Badge variant={selectedHour.status === 'APPROVED' ? 'default' : selectedHour.status === 'BILLED' ? 'default' : selectedHour.status === 'REJECTED' ? 'destructive' : 'secondary'} className="mt-1">
                                        {String(selectedHour.status || "UNKNOWN")}
                                    </Badge>
                                </div>
                                {('supervisionType' in selectedHour || 'supervisorId' in selectedHour) && (
                                    <>
                                        <div className="col-span-2 border-t pt-4 mt-2">
                                            <p className="text-muted-foreground text-xs">Activity Type</p>
                                            <p className="font-medium">{String(selectedHour.activityType || "N/A").replace(/_/g, ' ')}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground text-xs">Setting</p>
                                            <p className="font-medium">{String(selectedHour.setting || "N/A").replace(/_/g, ' ')}</p>
                                        </div>
                                    </>
                                )}
                                {selectedHour.notes && (
                                    <div className="col-span-2 border-t pt-4 mt-2">
                                        <p className="text-muted-foreground text-xs">Notes</p>
                                        <p className="italic bg-muted/30 p-3 rounded-lg mt-1">{String(selectedHour.notes)}</p>
                                    </div>
                                )}
                                {selectedHour.groupTopic && (
                                    <div className="col-span-2 border-t pt-4 mt-2">
                                        <p className="text-muted-foreground text-xs">Group Topic</p>
                                        <p className="font-medium">{String(selectedHour.groupTopic)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
