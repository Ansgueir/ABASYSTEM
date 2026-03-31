"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock, Calendar, FileText, Tag, MapPin, Check, X } from "lucide-react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function SupervisorTimesheetClientView({ hours, students }: { hours: any[], students: any[] }) {
    const [selectedEntry, setSelectedEntry] = useState<any>(null)
    const [userSelectedStudentId, setUserSelectedStudentId] = useState<string>("all")
    
    // Status update logic requires calling a server action ideally, but we will mock or implement the API call.
    // In timesheets-tab.tsx, there was a `handleUpdateStatus` function that called an endpoint.
    const [isUpdating, setIsUpdating] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [showRejectInput, setShowRejectInput] = useState(false)

    // Wait, since we are fetching via server components, and this is a general view, we can just point to the API.
    const handleUpdateStatus = async (id: string, type: string, status: "APPROVED" | "REJECTED") => {
        setIsUpdating(true)
        try {
            const endpoint = type === 'INDEPENDENT'
                ? `/api/student/log-hours/${id}`
                : `/api/supervisor/log-hours/${id}`
            const res = await fetch(endpoint, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, rejectReason: status === "REJECTED" ? rejectReason : undefined }),
            })
            if (!res.ok) throw new Error("Failed to update status")
            toast.success(`Entry ${status.toLowerCase()} successfully`)
            // Typically this would also refresh the page data
            window.location.reload()
        } catch (error) {
            console.error(error)
            toast.error("Failed to update status")
        } finally {
            setIsUpdating(false)
        }
    }

    const filteredHours = userSelectedStudentId === "all" 
        ? hours 
        : hours.filter(h => h.studentId === userSelectedStudentId)
        
    const getHours = (h: any) => Number(h.hours) || 0

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Select value={userSelectedStudentId} onValueChange={setUserSelectedStudentId}>
                    <SelectTrigger className="w-[280px] bg-background">
                        <SelectValue placeholder="Display All Students" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Display All Students</SelectItem>
                        {students.map((st: any) => (
                            <SelectItem key={st.id} value={st.id}>{st.fullName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="w-full flex justify-center items-center">
                <div className="w-full relative">
                    <TimesheetCalendar 
                        hours={filteredHours} 
                        role="supervisor" 
                        onEventClick={setSelectedEntry} 
                    />
                </div>
            </div>

            {/* Shared Modal for selected entry (Supervisor mode) */}
            <Dialog open={!!selectedEntry} onOpenChange={(open) => {
                if (!open) {
                    setSelectedEntry(null)
                    setShowRejectInput(false)
                    setRejectReason("")
                }
            }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    {selectedEntry && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        Activity Details
                                    </div>
                                    <Badge variant={selectedEntry.status === 'APPROVED' ? 'default' : selectedEntry.status === 'REJECTED' ? 'destructive' : 'outline'}
                                            className={selectedEntry.status === 'APPROVED' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}>
                                        {selectedEntry.status || "PENDING"}
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription>
                                    Review full entry details for compliance auditing.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 py-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Student Logged</p>
                                    <p className="text-sm font-semibold">{selectedEntry.student?.firstName} {selectedEntry.student?.lastName}</p>
                                </div>
                                <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                                    <div className="bg-background p-2 rounded-md shadow-sm">
                                        <Calendar className="h-4 w-4 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Execution Date</p>
                                        <p className="text-sm font-semibold">{format(new Date(selectedEntry.date), "EEEE, MMMM do, yyyy")}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg border bg-card">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Service Window</span>
                                        </div>
                                        <p className="text-sm font-semibold">
                                            {format(new Date(selectedEntry.startTime || selectedEntry.date), 'h:mm a')} - {
                                            (() => {
                                                const start = new Date(selectedEntry.startTime || selectedEntry.date);
                                                const durationMs = (getHours(selectedEntry) || 1) * 3600000;
                                                const end = new Date(start.getTime() + durationMs);
                                                return format(end, 'h:mm a');
                                            })()
                                            }
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-lg border bg-card text-right">
                                        <div className="flex items-center justify-end gap-2 mb-1">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
                                            <Tag className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                        <p className="text-sm font-bold text-primary">{getHours(selectedEntry).toFixed(2)} hours</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Type</p>
                                            <Badge variant="secondary" className="font-mono text-[10px]">{selectedEntry.type}</Badge>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Category</p>
                                            <Badge variant={selectedEntry.activityType === 'RESTRICTED' ? 'destructive' : 'default'} className="text-[10px]">
                                                {selectedEntry.activityType}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Setting</p>
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <MapPin className="h-4 w-4 text-muted-foreground" />
                                            <span className="capitalize">{selectedEntry.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</span>
                                        </div>
                                    </div>
                                    
                                    {(selectedEntry.type === 'SUPERVISION' || selectedEntry.type === 'supervised') && (
                                        <div className="space-y-1 gap-2 text-sm font-medium">
                                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Format</span>
                                            <p className="capitalize">{selectedEntry.supervisionType?.toLowerCase() || 'N/A'}</p>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Notes / Description</p>
                                        <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed border italic text-muted-foreground">
                                            {selectedEntry.notes || selectedEntry.groupTopic || "No additional description provided."}
                                        </div>
                                    </div>
                                </div>
                                
                                {(!selectedEntry.status || selectedEntry.status === "PENDING") && (
                                    <div className="pt-4 border-t flex flex-col gap-3">
                                        {showRejectInput ? (
                                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                                <Label>Reason for rejection</Label>
                                                <textarea
                                                    className="w-full min-h-[100px] p-3 text-sm rounded-md border bg-background"
                                                    placeholder="This will be visible to the student..."
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                />
                                                <div className="flex gap-2 justify-end">
                                                    <Button variant="ghost" onClick={() => setShowRejectInput(false)} disabled={isUpdating}>
                                                        Cancel
                                                    </Button>
                                                    <Button 
                                                        variant="destructive" 
                                                        onClick={async () => {
                                                            await handleUpdateStatus(selectedEntry.id, selectedEntry.type, "REJECTED")
                                                            setSelectedEntry(null)
                                                            setShowRejectInput(false)
                                                        }}
                                                        disabled={!rejectReason.trim() || isUpdating}
                                                    >
                                                        {isUpdating ? "Rejecting..." : "Confirm Rejection"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <Button 
                                                    variant="outline" 
                                                    className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive"
                                                    onClick={() => setShowRejectInput(true)}
                                                >
                                                    <X className="h-4 w-4 mr-2" /> Reject
                                                </Button>
                                                <Button 
                                                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                                                    onClick={async () => {
                                                        await handleUpdateStatus(selectedEntry.id, selectedEntry.type, "APPROVED")
                                                        setSelectedEntry(null)
                                                    }}
                                                    disabled={isUpdating}
                                                >
                                                    <Check className="h-4 w-4 mr-2" /> Approve
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
