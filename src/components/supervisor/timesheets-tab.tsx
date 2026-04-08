"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Clock, Calendar, FileText, MapPin, Tag, Check, X, FileSignature } from "lucide-react"
import { toast } from "sonner"
import { updateHourStatus } from "@/actions/audit"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"

interface TimesheetsTabProps {
    // Using any[] to allow serialized data (number instead of Decimal) without strict type conflicts
    independentHours: any[]
    supervisionHours: any[]
}

export function TimesheetsTab({ independentHours, supervisionHours }: TimesheetsTabProps) {
    const [isUpdating, setIsUpdating] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [selectedEntry, setSelectedEntry] = useState<any>(null)
    const [showRejectInput, setShowRejectInput] = useState(false)

    const handleUpdateStatus = async (id: string, type: string, status: "APPROVED" | "REJECTED") => {
        setIsUpdating(true)
        const formData = new FormData()
        formData.append("id", id)
        formData.append("type", type)
        formData.append("status", status)
        if (status === "REJECTED") {
            formData.append("rejectReason", rejectReason)
        }

        const res = await updateHourStatus(formData)
        setIsUpdating(false)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Hour ${status.toLowerCase()} successfully`)
            setRejectReason("")
        }
    }

    // Combine and sort
    const allEntries = [
        ...independentHours.map(h => ({ ...h, type: 'INDEPENDENT' })),
        ...supervisionHours.map(h => ({ ...h, type: 'SUPERVISION' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Safe parsing of hours which might be strings, numbers, or Decimals depending on serialization
    const getHours = (h: any) => Number(h.hours) || 0

    const validEntries = allEntries.filter(e => e.status !== 'REJECTED')
    const totalHours = validEntries.reduce((sum, entry) => sum + getHours(entry), 0)
    const restrictedHours = validEntries.filter(e => e.activityType === 'RESTRICTED').reduce((sum, entry) => sum + getHours(entry), 0)
    const unrestrictedHours = validEntries.filter(e => e.activityType === 'UNRESTRICTED').reduce((sum, entry) => sum + getHours(entry), 0)

    // Rule: "Alerta si las horas restringidas superan el 40% (BCBA)"
    const isAlert = totalHours > 0 && (restrictedHours / totalHours) > 0.4

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Timesheets Audit</CardTitle>
                    <CardDescription>Review logged hours and activities.</CardDescription>
                </div>
                <div className="flex gap-4 items-center text-sm font-medium">
                    <Button variant="default" size="sm" className="gap-2" onClick={() => {
                        const firstEntry = allEntries.length > 0 ? allEntries[0] : null;
                        if (firstEntry?.studentId) {
                            const dateObj = new Date(firstEntry.date);
                            const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                            window.open(`/api/pdf/mvf/${firstEntry.studentId}?month=${monthStr}`, "_blank")
                        } else {
                            toast.error("No hours found to generate MVF");
                        }
                    }}>
                        <FileSignature className="w-4 h-4" /> Generate Monthly Form (MVF)
                    </Button>
                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground">Total</span>
                        <span>{totalHours.toFixed(2)} hrs</span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <span className="text-muted-foreground">Restricted / Unrestricted</span>
                        <span className={isAlert ? "text-destructive font-bold" : "text-success"}>
                            {restrictedHours.toFixed(2)} / {unrestrictedHours.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Supervisor Calendar View */}
                <TimesheetCalendar 
                    hours={allEntries} 
                    role="supervisor" 
                    onEventClick={setSelectedEntry} 
                />

                {/* Shared Modal for selected entry */}
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
            </CardContent>
        </Card >
    )
}
