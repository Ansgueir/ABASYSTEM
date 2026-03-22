"use client"

import { useState, useTransition } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, Clock, Calendar, AlertCircle, Pencil, Lock } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { updateIndependentHour } from "@/actions/log-hours"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface HourDetailsDialogProps {
    hour: any
}

const SETTINGS = ["CLIENTS_HOME", "SCHOOL", "DAYCARE", "OFFICE_CLINIC", "GROUP_HOME", "COMMUNITY"]
const ACTIVITIES = ["RESTRICTED", "UNRESTRICTED"]

export function HourDetailsDialog({ hour }: HourDetailsDialogProps) {
    const [editOpen, setEditOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Edit fields
    const [notes, setNotes] = useState(hour?.notes || "")
    const [setting, setSetting] = useState(hour?.setting || "")
    const [activityType, setActivityType] = useState(hour?.activityType || "")
    const [minutes, setMinutes] = useState(Math.round((Number(hour?.hours) || 1) * 60))
    const [type, setType] = useState<'independent' | 'supervision'>(
        (hour?.type === 'supervised' || hour?.type === 'supervision') ? 'supervision' : 'independent'
    )
    // Date as YYYY-MM-DD string for <input type="date">
    const [dateStr, setDateStr] = useState(
        hour?.date ? format(new Date(hour.date), 'yyyy-MM-dd') : ''
    )
    // StartTime as HH:MM string
    const [startTimeStr, setStartTimeStr] = useState(
        hour?.startTime ? format(new Date(hour.startTime), 'HH:mm') : '09:00'
    )

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
                setEditOpen(false)
            }
        })
    }

    return (
        <div className="flex items-center gap-1">
            {/* View Dialog */}
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
                            <span className="font-semibold text-lg">
                                {hour.type === 'supervised' || hour.type === 'SUPERVISED' ? 'Supervised Hours' : 'Independent Hours'}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                isApproved ? 'bg-success/10 text-success'
                                : hour.status === 'PENDING' || hour.status === 'pending' ? 'bg-warning/10 text-warning'
                                : hour.status === 'REJECTED' || hour.status === 'rejected' ? 'bg-destructive/10 text-destructive'
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
                            {(hour.type === 'supervised' || hour.type === 'SUPERVISED') && (
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
                </DialogContent>
            </Dialog>

            {/* Edit Dialog — only for PENDING independent hours */}
            {isEditable ? (
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Edit this log">
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Pencil className="h-4 w-4" /> Edit Log Entry
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-date">Date of Service</Label>
                                    <Input
                                        id="edit-date"
                                        type="date"
                                        value={dateStr}
                                        onChange={e => setDateStr(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-starttime">Start Time</Label>
                                    <Input
                                        id="edit-starttime"
                                        type="time"
                                        value={startTimeStr}
                                        onChange={e => setStartTimeStr(e.target.value)}
                                    />
                                </div>
                            </div>
                            {/* Type — full width row */}
                            <div className="space-y-2">
                                <Label htmlFor="edit-type">Type</Label>
                                <Select value={type} onValueChange={(v) => setType(v as 'independent' | 'supervision')}>
                                    <SelectTrigger id="edit-type" className="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="independent">Independent</SelectItem>
                                        <SelectItem value="supervision">Supervised</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-setting">Setting</Label>
                                    <Select value={setting} onValueChange={setSetting}>
                                        <SelectTrigger id="edit-setting">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SETTINGS.map(s => (
                                                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-activity">Activity</Label>
                                    <Select value={activityType} onValueChange={setActivityType}>
                                        <SelectTrigger id="edit-activity">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACTIVITIES.map(a => (
                                                <SelectItem key={a} value={a}>{a}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-minutes">Duration (Minutes)</Label>
                                <Input
                                    id="edit-minutes"
                                    type="number"
                                    value={minutes}
                                    onChange={e => setMinutes(Number(e.target.value))}
                                    min={1}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-notes">Notes</Label>
                                <Input
                                    id="edit-notes"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Description of activities..."
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave} disabled={isPending}>
                                {isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            ) : hour.type === 'independent' && (isApproved || isBilled) ? (
                // Show locked icon with tooltip for approved independent hours
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full cursor-not-allowed opacity-50" title="Approved logs cannot be edited">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                </Button>
            ) : null}
        </div>
    )
}
