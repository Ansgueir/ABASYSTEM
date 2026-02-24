"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateGroupSession, deleteGroupSession } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { CalendarIcon, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface GroupSessionDetailsDialogProps {
    session: any
    supervisors?: { id: string, fullName: string }[]
    children: React.ReactNode
}

export function GroupSessionDetailsDialog({ session, supervisors, children }: GroupSessionDetailsDialogProps) {
    const [open, setOpen] = useState(false)
    const [isEditing, setIsEditing] = useState(false)
    const [topic, setTopic] = useState(session.topic)
    const [date, setDate] = useState<Date | undefined>(new Date(session.date))

    // Extract time from startTime
    const sessionTimeObj = new Date(session.startTime)
    const hours = sessionTimeObj.getHours().toString().padStart(2, '0')
    const mins = sessionTimeObj.getMinutes().toString().padStart(2, '0')
    const [time, setTime] = useState(`${hours}:${mins}`)

    const [maxStudents, setMaxStudents] = useState(session.maxStudents.toString())
    const [supervisorId, setSupervisorId] = useState(session.supervisorId)
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        if (!isEditing) {
            setIsEditing(true)
            return
        }

        setIsPending(true)
        if (!date) {
            toast.error("Please select a date.")
            setIsPending(false)
            return
        }

        const res = await updateGroupSession(session.id, date, time, topic, parseInt(maxStudents), supervisorId)
        setIsPending(false)
        if (res.success) {
            setIsEditing(false)
            toast.success("Session updated!")
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    async function handleDelete() {
        if (!confirm("Are you sure you want to delete this session? This action cannot be undone.")) return

        setIsPending(true)
        const res = await deleteGroupSession(session.id)
        setIsPending(false)
        if (res.success) {
            setOpen(false)
            toast.success("Session deleted successfully")
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    const resetForm = () => {
        setTopic(session.topic)
        setDate(new Date(session.date))
        setTime(`${hours}:${mins}`)
        setMaxStudents(session.maxStudents.toString())
        setSupervisorId(session.supervisorId)
        setIsEditing(false)
    }

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) resetForm()
            setOpen(v)
        }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex justify-between items-center pr-8">
                        <DialogTitle>{isEditing ? "Edit Session" : "Session Details"}</DialogTitle>
                        {!isEditing && (
                            <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogHeader>
                <form onSubmit={handleUpdate} className="space-y-4">
                    {supervisors && supervisors.length > 0 && (
                        <div className="space-y-2">
                            <Label>Supervisor</Label>
                            {isEditing ? (
                                <Select onValueChange={setSupervisorId} value={supervisorId} required>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select supervisor..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {supervisors.map(sup => (
                                            <SelectItem key={sup.id} value={sup.id}>{sup.fullName}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="p-2 border rounded-md bg-muted/30">{session.supervisor?.fullName || "Not assigned"}</div>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label>Topic</Label>
                        {isEditing ? (
                            <Input value={topic} onChange={e => setTopic(e.target.value)} required />
                        ) : (
                            <div className="p-2 border rounded-md bg-muted/30 font-medium">{session.topic}</div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 flex flex-col pt-2 max-w-full overflow-hidden">
                            <Label>Date</Label>
                            {isEditing ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={date}
                                            onSelect={setDate}
                                            disabled={(day) => day < new Date("1900-01-01")}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <div className="p-2 border rounded-md bg-muted/30 flex items-center">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                                    {format(new Date(session.date), "PPP")}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Time</Label>
                            {isEditing ? (
                                <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
                            ) : (
                                <div className="p-2 border rounded-md bg-muted/30">{time}</div>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Max Students (Limit 10)</Label>
                        {isEditing ? (
                            <Input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} max={10} min={1} required />
                        ) : (
                            <div className="p-2 border rounded-md bg-muted/30">{session.maxStudents}</div>
                        )}
                    </div>

                    {!isEditing && (
                        <div className="space-y-2">
                            <Label>Attendees ({session.participants?.length || 0} / {session.maxStudents})</Label>
                            <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-2">
                                {session.participants && session.participants.length > 0 ? (
                                    session.participants.map((p: any) => (
                                        <div key={p.id} className="flex justify-between items-center text-sm">
                                            <span>{p.student?.fullName || "Unknown Student"}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center">No students registered.</div>
                                )}
                            </div>
                        </div>
                    )}

                    {isEditing && (
                        <div className="pt-4 flex justify-end">
                            <Button type="button" variant="ghost" onClick={resetForm} className="mr-2">Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Save Changes"}</Button>
                        </div>
                    )}
                </form>
            </DialogContent>
        </Dialog>
    )
}
