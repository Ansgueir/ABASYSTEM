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
    DialogTrigger,
} from "@/components/ui/dialog"

export function StudentActivityTab({ supervisionHours = [], independentHours = [] }: { supervisionHours: any[], independentHours: any[] }) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground">Loading activity history...</div>
    }

    const safeSupervision = Array.isArray(supervisionHours) ? supervisionHours : []
    const safeIndependent = Array.isArray(independentHours) ? independentHours : []

    const allHours = [...safeSupervision, ...safeIndependent]
        .filter((h: any) => h && (h.status === "APPROVED" || h.status === "BILLED"))
        .sort((a: any, b: any) => {
            const dateA = a?.date ? new Date(a.date).getTime() : 0;
            const dateB = b?.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
        })

    return (
        <div className="rounded-xl border bg-card p-6">
            <h3 className="font-semibold text-lg mb-4">Approved Activity Logs</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-muted-foreground">
                            <th className="text-left font-medium p-3">Date</th>
                            <th className="text-left font-medium p-3">Type</th>
                            <th className="text-left font-medium p-3">Hours</th>
                            <th className="text-left font-medium p-3">Status</th>
                            <th className="text-right font-medium p-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {allHours.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                                    No approved or billed activity found.
                                </td>
                            </tr>
                        ) : (
                            allHours.map((hour: any) => {
                                const hourDate = hour?.date ? new Date(hour.date) : null;
                                const isValidDate = hourDate && !isNaN(hourDate.getTime());
                                const isSupervised = 'supervisionType' in hour || 'supervisorId' in hour;

                                return (
                                    <tr key={hour.id} className="hover:bg-muted/50 transition-colors">
                                        <td className="p-3">
                                            {isValidDate ? format(hourDate!, "MMM d, yyyy") : "N/A"}
                                        </td>
                                        <td className="p-3 font-medium">
                                            {isSupervised ? 'Supervised' : 'Independent'}
                                        </td>
                                        <td className="p-3">
                                            {typeof hour.hours === 'number' ? hour.hours.toFixed(1) :
                                                (typeof hour.hours === 'string' ? parseFloat(hour.hours).toFixed(1) : "0.0")} hrs
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={hour.status === 'BILLED' ? 'default' : 'secondary'}>
                                                {String(hour.status || "UNKNOWN")}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-md">
                                                    <DialogHeader>
                                                        <DialogTitle>Activity Details</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4 text-sm">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Date</p>
                                                                <p className="font-medium">
                                                                    {isValidDate ? format(hourDate!, "MMMM d, yyyy") : "N/A"}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Duration</p>
                                                                <p className="font-medium">
                                                                    {Number(hour.hours || 0).toFixed(1)} hrs
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Type</p>
                                                                <p className="font-medium">
                                                                    {isSupervised ? 'Supervised' : 'Independent'}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Status</p>
                                                                <Badge variant={hour.status === 'BILLED' ? 'default' : 'secondary'} className="mt-1">
                                                                    {String(hour.status || "UNKNOWN")}
                                                                </Badge>
                                                            </div>
                                                            {isSupervised && (
                                                                <>
                                                                    <div className="col-span-2 border-t pt-4 mt-2">
                                                                        <p className="text-muted-foreground text-xs">Activity Type</p>
                                                                        <p className="font-medium">{String(hour.activityType || "N/A").replace(/_/g, ' ')}</p>
                                                                    </div>
                                                                    <div className="col-span-2">
                                                                        <p className="text-muted-foreground text-xs">Setting</p>
                                                                        <p className="font-medium">{String(hour.setting || "N/A").replace(/_/g, ' ')}</p>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {hour.notes && (
                                                                <div className="col-span-2 border-t pt-4 mt-2">
                                                                    <p className="text-muted-foreground text-xs">Notes</p>
                                                                    <p className="italic bg-muted/30 p-3 rounded-lg mt-1">{String(hour.notes)}</p>
                                                                </div>
                                                            )}
                                                            {hour.groupTopic && (
                                                                <div className="col-span-2 border-t pt-4 mt-2">
                                                                    <p className="text-muted-foreground text-xs">Group Topic</p>
                                                                    <p className="font-medium">{String(hour.groupTopic)}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
