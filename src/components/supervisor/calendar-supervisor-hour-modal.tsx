"use client"

import { useState, useTransition, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock, Calendar, AlertCircle, Pencil, Lock, Eye, MapPin, Tag, Check, X } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { updateIndependentHour, updateSupervisionHour } from "@/actions/log-hours"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface CalendarSupervisorHourModalProps {
    hour: any
    open: boolean
    onOpenChange: (open: boolean) => void
    onStatusUpdate: (id: string, type: string, status: "APPROVED" | "REJECTED", reason?: string) => Promise<void>
    isUpdatingStatus: boolean
}

const SETTINGS = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"]
const ACTIVITIES = ["RESTRICTED", "UNRESTRICTED"]
const FORMATS = ["INDIVIDUAL", "GROUP"]

export function CalendarSupervisorHourModal({ hour, open, onOpenChange, onStatusUpdate, isUpdatingStatus }: CalendarSupervisorHourModalProps) {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [isPending, startTransition] = useTransition()
    const [showRejectInput, setShowRejectInput] = useState(false)
    const [rejectReason, setRejectReason] = useState("")

    useEffect(() => {
        if (open) {
            setMode('view')
            setShowRejectInput(false)
            setRejectReason("")
        }
    }, [open, hour])

    const [notes, setNotes] = useState(hour?.notes || "")
    const [setting, setSetting] = useState(hour?.setting || "")
    const [activityType, setActivityType] = useState(hour?.activityType || "")
    const [supervisionType, setSupervisionType] = useState(hour?.supervisionType || "INDIVIDUAL")
    const [minutes, setMinutes] = useState(Math.round((Number(hour?.hours) || 1) * 60))
    const [dateStr, setDateStr] = useState(
        hour?.date ? format(new Date(hour.date), 'yyyy-MM-dd') : ''
    )
    const [startTimeStr, setStartTimeStr] = useState(
        hour?.startTime ? format(new Date(hour.startTime), 'HH:mm') : '09:00'
    )
    const [endTimeStr, setEndTimeStr] = useState(() => {
        if (!hour?.startTime) return '10:00'
        const start = new Date(hour.startTime)
        const duration = Math.round((Number(hour?.hours) || 1) * 60)
        const end = new Date(start.getTime() + duration * 60000)
        return format(end, 'HH:mm')
    })
    
    useEffect(() => {
        if (hour) {
            setNotes(hour.notes || hour.groupTopic || "")
            setSetting(hour.setting || "")
            setActivityType(hour.activityType || "")
            setSupervisionType(hour.supervisionType || "INDIVIDUAL")
            setMinutes(Math.round((Number(hour.hours) || 1) * 60))
            setDateStr(hour.date ? format(new Date(hour.date), 'yyyy-MM-dd') : '')
            setStartTimeStr(hour.startTime ? format(new Date(hour.startTime), 'HH:mm') : '09:00')
            
            const start = new Date(hour.startTime || new Date())
            const duration = Math.round((Number(hour.hours) || 1) * 60)
            const end = new Date(start.getTime() + duration * 60000)
            setEndTimeStr(format(end, 'HH:mm'))
        }
    }, [hour])

    if (!hour) return null

    const isApproved = hour.status === 'APPROVED' || hour.status === 'approved'
    const isBilled = hour.status === 'BILLED' || hour.status === 'billed'
    const isEditable = !isApproved && !isBilled

    const handleSave = () => {
        startTransition(async () => {
            const data = {
                notes,
                setting,
                activityType,
                supervisionType: hour.type === 'supervised' || hour.type === 'SUPERVISION' ? supervisionType : undefined,
                minutes,
                date: dateStr || undefined,
                startTime: startTimeStr || undefined,
            }

            const result = hour.type === 'supervised' || hour.type === 'SUPERVISION' 
                ? await updateSupervisionHour(hour.id, data) 
                : await updateIndependentHour(hour.id, data as any)

            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Log updated successfully")
                setMode('view')
                onOpenChange(false)
                window.location.reload()
            }
        })
    }

    const getHours = (h: any) => Number(h.hours) || 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            {mode === 'edit' ? <Pencil className="h-4 w-4 text-primary" /> : <Eye className="h-4 w-4 text-primary" />}
                            {mode === 'edit' ? 'Edit Activity Details' : 'Activity Details'}
                        </span>
                        {mode === 'view' && isEditable && (
                            <Button variant="outline" size="sm" onClick={() => setMode('edit')} className="mr-8">
                                <Pencil className="h-3 w-3 mr-2" /> Edit
                            </Button>
                        )}
                        {mode === 'edit' && (
                            <Button variant="ghost" size="sm" onClick={() => setMode('view')} className="mr-8">
                                Cancel Edit
                            </Button>
                        )}
                    </DialogTitle>
                </DialogHeader>

                {mode === 'view' ? (
                    <div className="grid gap-4 py-4">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Student Logged</p>
                                <p className="text-sm font-semibold">{hour.student?.firstName} {hour.student?.lastName}</p>
                            </div>
                            <Badge variant={hour.status === 'APPROVED' || hour.status === 'BILLED' ? 'default' : hour.status === 'REJECTED' ? 'destructive' : 'outline'}
                                    className={hour.status === 'APPROVED' || hour.status === 'BILLED' ? 'bg-success text-success-foreground hover:bg-success/90' : ''}>
                                {hour.status || "PENDING"}
                            </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                            <div className="bg-background p-2 rounded-md shadow-sm">
                                <Calendar className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Execution Date</p>
                                <p className="text-sm font-semibold">{format(new Date(hour.date), "EEEE, MMMM do, yyyy")}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border bg-card">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Service Window</span>
                                </div>
                                <p className="text-sm font-semibold">
                                    {format(new Date(hour.startTime || hour.date), 'h:mm a')} - {
                                    (() => {
                                        const start = new Date(hour.startTime || hour.date);
                                        const durationMs = (getHours(hour) || 1) * 3600000;
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
                                <p className="text-sm font-bold text-primary">{getHours(hour).toFixed(2)} hours</p>
                            </div>
                        </div>

                        <div className="space-y-3 mt-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Type</p>
                                    <Badge variant="secondary" className="font-mono text-[10px]">{hour.type}</Badge>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Category</p>
                                    <Badge variant={hour.activityType === 'RESTRICTED' ? 'destructive' : 'default'} className="text-[10px]">
                                        {hour.activityType}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Setting</p>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span className="capitalize">{hour.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</span>
                                </div>
                            </div>
                            
                            {(hour.type === 'SUPERVISION' || hour.type === 'supervised') && (
                                <div className="space-y-1 gap-2 text-sm font-medium">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Format</span>
                                    <p className="capitalize">{hour.supervisionType?.toLowerCase() || 'N/A'}</p>
                                </div>
                            )}

                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Notes / Description</p>
                                <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed border italic text-muted-foreground">
                                    {hour.notes || hour.groupTopic || "No additional description provided."}
                                </div>
                            </div>
                        </div>
                        
                        {(hour.status === 'REJECTED' || hour.status === 'rejected') && hour.rejectReason && (
                            <div className="space-y-1 pt-2 border-t mt-2">
                                <span className="text-[10px] text-destructive uppercase font-bold flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Rejection Reason
                                </span>
                                <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">{hour.rejectReason}</p>
                            </div>
                        )}
                        
                        {(!hour.status || hour.status === "PENDING") && (
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
                                            <Button variant="ghost" onClick={() => setShowRejectInput(false)} disabled={isUpdatingStatus}>
                                                Cancel
                                            </Button>
                                            <Button 
                                                variant="destructive" 
                                                onClick={async () => {
                                                    await onStatusUpdate(hour.id, hour.type, "REJECTED", rejectReason)
                                                    onOpenChange(false)
                                                }}
                                                disabled={!rejectReason.trim() || isUpdatingStatus}
                                            >
                                                {isUpdatingStatus ? "Rejecting..." : "Confirm Rejection"}
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Button 
                                            variant="outline" 
                                            className="flex-1 text-destructive hover:bg-destructive hover:text-destructive-foreground border-destructive"
                                            onClick={() => setShowRejectInput(true)}
                                            disabled={isUpdatingStatus}
                                        >
                                            <X className="h-4 w-4 mr-2" /> Reject
                                        </Button>
                                        <Button 
                                            className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                                            onClick={async () => {
                                                await onStatusUpdate(hour.id, hour.type, "APPROVED")
                                                onOpenChange(false)
                                            }}
                                            disabled={isUpdatingStatus}
                                        >
                                            <Check className="h-4 w-4 mr-2" /> Approve
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-date">Date of Service</Label>
                                <Input
                                    id="edit-date"
                                    type="date"
                                    value={dateStr}
                                    onChange={e => setDateStr(e.target.value)}
                                    disabled={!isEditable}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-times">Service Window</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="relative flex items-center">
                                        <span className="absolute left-2 top-0.5 text-[8px] uppercase text-muted-foreground font-bold pointer-events-none z-10">Start</span>
                                        <Input
                                            id="edit-starttime"
                                            type="time"
                                            disabled={!isEditable}
                                            className="pt-4 pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            value={startTimeStr}
                                            onChange={e => {
                                                const newStart = e.target.value
                                                setStartTimeStr(newStart)
                                                const [h1, m1] = newStart.split(':').map(Number)
                                                const [h2, m2] = endTimeStr.split(':').map(Number)
                                                let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
                                                if (diff < 0) diff += 1440
                                                setMinutes(diff)
                                            }}
                                        />
                                        <Clock className="absolute right-3 bottom-2 h-4 w-4 text-muted-foreground pointer-events-none opacity-60" />
                                    </div>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-2 top-0.5 text-[8px] uppercase text-muted-foreground font-bold pointer-events-none z-10">End</span>
                                        <Input
                                            id="edit-endtime"
                                            type="time"
                                            disabled={!isEditable}
                                            className="pt-4 pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                            value={endTimeStr}
                                            onChange={e => {
                                                const newEnd = e.target.value
                                                setEndTimeStr(newEnd)
                                                const [h1, m1] = startTimeStr.split(':').map(Number)
                                                const [h2, m2] = newEnd.split(':').map(Number)
                                                let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
                                                if (diff < 0) diff += 1440
                                                setMinutes(diff)
                                            }}
                                        />
                                        <Clock className="absolute right-3 bottom-2 h-4 w-4 text-muted-foreground pointer-events-none opacity-60" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Calculated Duration</span>
                            <span className="text-sm font-bold text-indigo-900">{(minutes / 60).toFixed(2)} hours</span>
                        </div>

                        <div className="space-y-2 mt-4">
                            <Label htmlFor="edit-activity">Activity Type</Label>
                            <Select value={activityType} onValueChange={setActivityType} disabled={!isEditable}>
                                <SelectTrigger id="edit-activity">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACTIVITIES.map(act => (
                                        <SelectItem key={act} value={act}>{act}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {(hour.type === 'supervised' || hour.type === 'SUPERVISION') && (
                            <div className="space-y-2">
                                <Label htmlFor="edit-format">Format</Label>
                                <Select value={supervisionType} onValueChange={setSupervisionType} disabled={!isEditable}>
                                    <SelectTrigger id="edit-format">
                                        <SelectValue placeholder="Select format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FORMATS.map(f => (
                                            <SelectItem key={f} value={f}>{f}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="edit-setting">Setting</Label>
                            <Select value={setting} onValueChange={setSetting} disabled={!isEditable}>
                                <SelectTrigger id="edit-setting">
                                    <SelectValue placeholder="Select setting" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SETTINGS.map(s => (
                                        <SelectItem key={s} value={s}>
                                            {s.replace(/_/g, ' ')}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Notes / Group Topic</Label>
                            <Input
                                id="edit-notes"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                disabled={!isEditable}
                                placeholder="Describe the activity..."
                            />
                        </div>

                        {isEditable && (
                            <DialogFooter className="mt-6">
                                <Button type="button" disabled={isPending} onClick={handleSave} className="w-full">
                                    {isPending ? "Saving..." : "Save Changes"}
                                </Button>
                            </DialogFooter>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
