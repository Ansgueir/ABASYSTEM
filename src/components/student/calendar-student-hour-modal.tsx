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
import { Clock, Calendar, AlertCircle, Pencil, Lock, Eye } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { updateIndependentHour } from "@/actions/log-hours"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CalendarStudentHourModalProps {
    hour: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

const SETTINGS = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"]
const ACTIVITIES = ["RESTRICTED", "UNRESTRICTED"]

export function CalendarStudentHourModal({ hour, open, onOpenChange }: CalendarStudentHourModalProps) {
    const [mode, setMode] = useState<'view' | 'edit'>('view')
    const [isPending, startTransition] = useTransition()

    // Reset mode to view when hour changes or modal opens
    useEffect(() => {
        if (open) {
            setMode('view')
        }
    }, [open, hour])

    // Edit fields
    const [notes, setNotes] = useState(hour?.notes || "")
    const [setting, setSetting] = useState(hour?.setting || "")
    const [activityType, setActivityType] = useState(hour?.activityType || "")
    const [minutes, setMinutes] = useState(Math.round((Number(hour?.hours) || 1) * 60))
    const [type, setType] = useState<'independent' | 'supervision'>(
        (hour?.type === 'supervised' || hour?.type === 'supervision') ? 'supervision' : 'independent'
    )
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
    
    // Update local state if hour prop changes while open (e.g. clicking different events fast)
    useEffect(() => {
        if (hour) {
            setNotes(hour.notes || "")
            setSetting(hour.setting || "")
            setActivityType(hour.activityType || "")
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
    const isEditable = !isApproved && !isBilled && hour.type === 'independent'

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateIndependentHour(hour.id, {
                notes,
                setting,
                activityType,
                minutes,
                type,
                date: dateStr || undefined,
                startTime: startTimeStr || undefined,
            })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Log updated successfully")
                setMode('view')
                onOpenChange(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            {mode === 'edit' ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {mode === 'edit' ? 'Edit Log Entry' : 'Hour Details'}
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
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="font-bold text-lg text-primary">
                                    {hour.supervisionType === 'GROUP' || !!hour.groupId ? 'Grupal' : 
                                     (hour.type === 'supervised' || hour.type === 'supervision' || hour.type === 'SUPERVISION' ? 'Supervisada' : 'Independiente')}
                                </span>
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Categoría de actividad</span>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${isApproved ? 'bg-success/10 text-success' : hour.status === 'PENDING' || hour.status === 'pending' ? 'bg-warning/10 text-warning' : hour.status === 'REJECTED' || hour.status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                                {hour.status?.toUpperCase() || 'LOGGED'}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                            <div className="space-y-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Date
                                </span>
                                <p className="font-medium">{format(new Date(hour.date), 'MMMM d, yyyy')}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Time Range
                                </span>
                                <p className="font-medium">
                                    {format(new Date(hour.startTime), 'h:mm a')} - {(() => {
                                        const start = new Date(hour.startTime)
                                        const end = new Date(start.getTime() + Number(hour.hours) * 3600000)
                                        return format(end, 'h:mm a')
                                    })()}
                                    <span className="text-muted-foreground ml-1">({Number(hour.hours).toFixed(1)}h)</span>
                                </p>
                            </div>
                            {(hour.type === 'supervised' || hour.type === 'SUPERVISED') && hour.supervisor && (
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
                                <p className="font-medium capitalize">{hour.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</p>
                            </div>
                        </div>

                        {(hour.notes || hour.groupTopic) && (
                            <div className="space-y-1 pt-2 border-t mt-4">
                                <span className="text-sm text-muted-foreground">Notes</span>
                                <p className="text-sm bg-muted/50 p-3 rounded-md">{hour.notes || hour.groupTopic}</p>
                            </div>
                        )}

                        {(hour.status === 'REJECTED' || hour.status === 'rejected') && hour.rejectReason && (
                            <div className="space-y-1 pt-2 border-t mt-4">
                                <span className="text-sm text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Rejection Reason
                                </span>
                                <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-md">{hour.rejectReason}</p>
                            </div>
                        )}

                        {isApproved && (
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border mt-2">
                                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="text-xs text-muted-foreground">This log is approved and locked. Contact your Office to request modifications.</p>
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
                                        <Clock className="absolute right-3 bottom-2 h-4 w-4 text-muted-foreground pointer-events-none opacity-60 pointer-events-none" />
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
                                        <Clock className="absolute right-3 bottom-2 h-4 w-4 text-muted-foreground pointer-events-none opacity-60 pointer-events-none" />
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
                            <Label htmlFor="edit-notes">Notes</Label>
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
