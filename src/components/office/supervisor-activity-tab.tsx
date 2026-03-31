"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export function SupervisorActivityTab({ supervisionHours = [] }: { supervisionHours: any[] }) {
    const [mounted, setMounted] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground">Loading activity history...</div>
    }

    const filteredHours = (supervisionHours || []).filter(hour => 
        (hour.student?.fullName || "Group Supervision").toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-4">
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by student name..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="rounded-xl border bg-card overflow-hidden">
                {filteredHours.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground">
                        {searchTerm ? "No matches found for this student." : "No activity logs found."}
                    </div>
                ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b bg-muted/10">
                                <th className="text-left font-medium p-3">Date</th>
                                <th className="text-left font-medium p-3">Student</th>
                                <th className="text-left font-medium p-3">Activity</th>
                                <th className="text-left font-medium p-3">Hours</th>
                                <th className="text-left font-medium p-3">Status</th>
                                <th className="text-right font-medium p-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredHours.map((hour: any) => {
                                const hourDate = hour?.date ? new Date(hour.date) : null;
                                const isValidDate = hourDate && !isNaN(hourDate.getTime());

                                return (
                                    <tr key={hour.id} className="hover:bg-muted/5 transition-colors">
                                        <td className="p-3 whitespace-nowrap">
                                            {isValidDate ? format(hourDate!, "MMM d, yyyy") : "N/A"}
                                        </td>
                                        <td className="p-3 font-medium">{hour.student?.fullName || 'Multiple Students'}</td>
                                        <td className="p-3 text-muted-foreground">{String(hour.activityType || 'Group Supervision').replace(/_/g, ' ')}</td>
                                        <td className="p-3">{Number(hour.hours || 0).toFixed(1)} hrs</td>
                                        <td className="p-3">
                                            <Badge variant={hour.status === 'APPROVED' ? 'default' : hour.status === 'BILLED' ? 'default' : hour.status === 'REJECTED' ? 'destructive' : 'secondary'}>
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
                                                                <p className="font-medium">{Number(hour.hours || 0).toFixed(1)} hrs</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Student</p>
                                                                <p className="font-medium">{hour.student?.fullName || 'Multiple Students'}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground text-xs">Status</p>
                                                                <Badge variant={hour.status === 'APPROVED' ? 'default' : hour.status === 'BILLED' ? 'default' : hour.status === 'REJECTED' ? 'destructive' : 'secondary'} className="mt-1">
                                                                    {String(hour.status || "UNKNOWN")}
                                                                </Badge>
                                                            </div>
                                                            <div className="col-span-2 border-t pt-4 mt-2">
                                                                <p className="text-muted-foreground text-xs">Activity Type</p>
                                                                <p className="font-medium">{String(hour.activityType || 'Group Supervision').replace(/_/g, ' ')}</p>
                                                            </div>
                                                            {hour.setting && (
                                                                <div className="col-span-2">
                                                                    <p className="text-muted-foreground text-xs">Setting</p>
                                                                    <p className="font-medium">{String(hour.setting).replace(/_/g, ' ')}</p>
                                                                </div>
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
                            })}
                        </tbody>
                        {supervisionHours.length === 100 && (
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className="p-4 text-center text-muted-foreground text-xs italic">
                                        Showing latest 100 entries. For older data, run a report.
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
                )}
            </div>
        </div>
    )
}
