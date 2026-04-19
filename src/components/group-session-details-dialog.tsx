"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
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
import { updateGroupSession, deleteGroupSession, deleteGroupSessionChain, updateGroupSessionChain } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { CalendarIcon, Edit, Trash2, Clock, Users, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface GroupSessionDetailsDialogProps {
    session: any
    supervisors?: { id: string, fullName: string }[]
    students?: { id: string, fullName: string }[]
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function GroupSessionDetailsDialog({ session, supervisors, students, children, open: externalOpen, onOpenChange }: GroupSessionDetailsDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = externalOpen !== undefined ? externalOpen : internalOpen
    const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen
    const [isEditing, setIsEditing] = useState(false)
    const [topic, setTopic] = useState(session.topic)
    const [date, setDate] = useState<Date | undefined>(new Date(session.date))

    const sessionTimeObj = new Date(session.startTime)
    const hours = sessionTimeObj.getHours().toString().padStart(2, '0')
    const mins = sessionTimeObj.getMinutes().toString().padStart(2, '0')
    
    const [startTimeStr, setStartTimeStr] = useState(`${hours}:${mins}`)
    const [endTimeStr, setEndTimeStr] = useState(() => {
        const start = new Date(session.startTime)
        const end = new Date(start.getTime() + 60 * 60000)
        return `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
    })
    const [durationMin, setDurationMin] = useState(60)

    const [maxStudents, setMaxStudents] = useState(session.maxStudents.toString())
    const [supervisorId, setSupervisorId] = useState(session.supervisorId)
    const [selectedStudents, setSelectedStudents] = useState<string[]>(
        session.participants?.map((p: any) => p.studentId) || []
    )
    const [studentSearch, setStudentSearch] = useState("")

    const [isPending, setIsPending] = useState(false)
    const [showChainConfirm, setShowChainConfirm] = useState(false)
    const [showChainEditConfirm, setShowChainEditConfirm] = useState(false)
    const router = useRouter()

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault()
        if (!isEditing) {
            setIsEditing(true)
            return
        }

        if (!date) {
            toast.error("Please select a date.")
            return
        }
        if (durationMin <= 0) {
            toast.error("End time must be after start time.")
            return
        }

        // If this session belongs to a recurrence chain, ask which scope
        if (session.recurrenceId) {
            setShowChainEditConfirm(true)
            return
        }

        // No chain — update single session directly
        await executeSingleUpdate()
    }

    async function executeSingleUpdate() {
        setIsPending(true)
        const res = await updateGroupSession(session.id, date!, startTimeStr, topic, parseInt(maxStudents), supervisorId, selectedStudents, durationMin)
        setIsPending(false)
        if (res.success) {
            setIsEditing(false)
            setShowChainEditConfirm(false)
            toast.success("Session updated!")
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    async function executeChainUpdate() {
        setIsPending(true)
        const res = await updateGroupSessionChain(
            session.id,
            startTimeStr,
            topic,
            parseInt(maxStudents),
            supervisorId,
            durationMin
        )
        setIsPending(false)
        if ('success' in res && res.success) {
            setIsEditing(false)
            setShowChainEditConfirm(false)
            toast.success(`Updated ${(res as any).updatedCount || 1} session(s) in the series!`)
            router.refresh()
        } else {
            toast.error((res as any).error || "Failed to update")
        }
    }

    async function handleDelete() {
        // If this session belongs to a chain, ask user what to do
        if (session.recurrenceId) {
            setShowChainConfirm(true)
            return
        }
        // No chain — simple single delete
        await executeSingleDelete()
    }

    async function executeSingleDelete() {
        setIsPending(true)
        const res = await deleteGroupSession(session.id)
        setIsPending(false)
        if (res.success) {
            setOpen(false)
            setShowChainConfirm(false)
            toast.success("Session deleted successfully")
            router.refresh()
        } else {
            toast.error(res.error)
        }
    }

    async function executeChainDelete() {
        setIsPending(true)
        const res = await deleteGroupSessionChain(session.id)
        setIsPending(false)
        if ('success' in res && res.success) {
            setOpen(false)
            setShowChainConfirm(false)
            toast.success(`Deleted ${(res as any).deletedCount || 1} session(s) successfully`)
            router.refresh()
        } else {
            toast.error((res as any).error || "Failed to delete")
        }
    }

    const resetForm = () => {
        setTopic(session.topic)
        setDate(new Date(session.date))
        setStartTimeStr(`${hours}:${mins}`)
        
        const end = new Date(sessionTimeObj.getTime() + 60 * 60000)
        setEndTimeStr(`${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`)
        setDurationMin(60)

        setMaxStudents(session.maxStudents.toString())
        setSupervisorId(session.supervisorId)
        setSelectedStudents(session.participants?.map((p: any) => p.studentId) || [])
        setStudentSearch("")
        setIsEditing(false)
    }

    return (
        <>
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) resetForm()
            setOpen(v)
        }}>
            {children && (
                <DialogTrigger asChild>
                    {children}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex justify-between items-center pr-8">
                        <DialogTitle className="flex items-center gap-2 text-indigo-600">
                            {isEditing ? <CheckCircle2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                            {isEditing ? "Edit Session" : "Session Details"}
                        </DialogTitle>
                        {!isEditing && (
                            <div className="flex space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-8 w-8 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                    {!isEditing && (
                        <DialogDescription className="text-xs">
                            View or edit the properties of this group session.
                        </DialogDescription>
                    )}
                </DialogHeader>

                <form onSubmit={handleUpdate} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
                        {supervisors && supervisors.length > 0 && (
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs font-bold uppercase ml-1">Supervisor</Label>
                                {isEditing ? (
                                    <Select onValueChange={setSupervisorId} value={supervisorId} required>
                                        <SelectTrigger className="rounded-xl border-indigo-100 bg-indigo-50/20">
                                            <SelectValue placeholder="Select supervisor..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {supervisors.map(sup => (
                                                <SelectItem key={sup.id} value={sup.id}>{sup.fullName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="p-3 border rounded-xl bg-muted/20 font-medium text-sm">{session.supervisor?.fullName || "Not assigned"}</div>
                                )}
                            </div>
                        )}
                        
                        <div className="space-y-1">
                            <Label className="text-muted-foreground text-xs font-bold uppercase ml-1">Topic / Description</Label>
                            {isEditing ? (
                                <Input 
                                    value={topic} 
                                    onChange={e => setTopic(e.target.value)} 
                                    required 
                                    className="rounded-xl bg-muted/20 border-indigo-100 focus:bg-background transition-all"
                                />
                            ) : (
                                <div className="p-3 border rounded-xl bg-indigo-50/30 font-semibold text-indigo-900">{session.topic}</div>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 pt-1">
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs font-bold uppercase ml-1">Date of Service</Label>
                                {isEditing ? (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal rounded-xl border-indigo-100",
                                                    !date && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-indigo-500" />
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
                                    <div className="p-3 border rounded-xl bg-muted/20 flex items-center text-sm">
                                        <CalendarIcon className="mr-2 h-4 w-4 text-indigo-400" />
                                        {format(new Date(session.date), "PPP")}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs font-bold uppercase ml-1">Capacity</Label>
                                {isEditing ? (
                                    <div className="relative">
                                        <Input 
                                            type="number" 
                                            value={maxStudents} 
                                            onChange={e => setMaxStudents(e.target.value)} 
                                            max={10} 
                                            min={1} 
                                            required 
                                            className="rounded-xl pl-9"
                                        />
                                        <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-60" />
                                    </div>
                                ) : (
                                    <div className="p-3 border rounded-xl bg-muted/20 flex items-center text-sm font-bold">
                                        <Users className="mr-2 h-4 w-4 text-indigo-400" />
                                        Max {session.maxStudents} Students
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1 pt-1">
                            <Label className="text-muted-foreground text-xs font-bold uppercase ml-1">Service Window</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <span className={cn("text-[10px] font-bold uppercase ml-2", isEditing ? "text-indigo-400" : "text-muted-foreground")}>Start</span>
                                    {isEditing ? (
                                        <div className="relative flex items-center">
                                            <Input
                                                type="time"
                                                required
                                                className="rounded-xl pr-10 pt-1 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                                value={startTimeStr}
                                                onChange={e => {
                                                    const newStart = e.target.value
                                                    setStartTimeStr(newStart)
                                                    const [h1, m1] = newStart.split(':').map(Number)
                                                    const [h2, m2] = endTimeStr.split(':').map(Number)
                                                    let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
                                                    if (diff < 0) diff += 1440
                                                    setDurationMin(diff)
                                                }}
                                            />
                                            <Clock className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none opacity-60" />
                                        </div>
                                    ) : (
                                        <div className="p-3 border rounded-xl bg-indigo-50/20 text-sm font-semibold">{startTimeStr}</div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <span className={cn("text-[10px] font-bold uppercase ml-2", isEditing ? "text-indigo-400" : "text-muted-foreground")}>End</span>
                                    {isEditing ? (
                                        <div className="relative flex items-center">
                                            <Input
                                                type="time"
                                                required
                                                className="rounded-xl pr-10 pt-1 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                                value={endTimeStr}
                                                onChange={e => {
                                                    const newEnd = e.target.value
                                                    setEndTimeStr(newEnd)
                                                    const [h1, m1] = startTimeStr.split(':').map(Number)
                                                    const [h2, m2] = newEnd.split(':').map(Number)
                                                    let diff = (h2 * 60 + m2) - (h1 * 60 + m1)
                                                    if (diff < 0) diff += 1440
                                                    setDurationMin(diff)
                                                }}
                                            />
                                            <Clock className="absolute right-3 h-4 w-4 text-muted-foreground pointer-events-none opacity-60" />
                                        </div>
                                    ) : (
                                        <div className="p-3 border rounded-xl bg-indigo-50/20 text-sm font-semibold">{endTimeStr}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-600/5 border border-indigo-200">
                            <div className="flex items-center gap-2 text-indigo-700">
                                <Clock className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase">Calculated duration</span>
                            </div>
                            <span className="text-sm font-black text-indigo-700">
                                {durationMin} min / {(durationMin / 60).toFixed(2)} hrs
                            </span>
                        </div>

                        {isEditing && students && students.length > 0 && (
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Update Attendees</Label>
                                    <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">
                                        {selectedStudents.length} / {maxStudents}
                                    </span>
                                </div>
                                <Input
                                    placeholder="Filter students..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    className="mb-2 h-8 rounded-xl border-dashed"
                                />
                                <div className="max-h-40 overflow-y-auto border border-indigo-50 rounded-xl p-3 space-y-2 bg-indigo-50/10">
                                    {students
                                        .filter(s => s.fullName.toLowerCase().includes(studentSearch.toLowerCase()))
                                        .map(student => (
                                            <div key={student.id} className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-indigo-50/50 transition-all">
                                                <input
                                                    type="checkbox"
                                                    id={`edit-student-${student.id}`}
                                                    checked={selectedStudents.includes(student.id)}
                                                    disabled={!selectedStudents.includes(student.id) && selectedStudents.length >= parseInt(maxStudents || "10")}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            if (selectedStudents.length < parseInt(maxStudents || "10")) {
                                                                setSelectedStudents([...selectedStudents, student.id])
                                                            }
                                                        } else {
                                                            setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                                                        }
                                                    }}
                                                    className="h-4 w-4 rounded-md border-indigo-300 text-indigo-600 accent-indigo-600 focus:ring-0 cursor-pointer"
                                                />
                                                <Label htmlFor={`edit-student-${student.id}`} className="font-normal cursor-pointer text-sm flex-1">{student.fullName}</Label>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {!isEditing && (
                            <div className="space-y-2 pt-2 border-t">
                                <div className="flex justify-between items-center mb-1">
                                    <Label className="text-xs font-bold uppercase text-muted-foreground ml-1">Current Attendees</Label>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                        {session.participants?.length || 0} / {session.maxStudents}
                                    </span>
                                </div>
                                <div className="max-h-32 overflow-y-auto border rounded-xl p-3 space-y-1.5 bg-muted/10">
                                    {session.participants && session.participants.length > 0 ? (
                                        session.participants.map((p: any) => (
                                            <div key={p.id} className="flex items-center gap-2 p-1 text-sm bg-white border border-indigo-50/50 rounded-lg shadow-sm">
                                                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                                    {p.student?.fullName?.charAt(0) || "U"}
                                                </div>
                                                <span className="font-medium text-gray-700">{p.student?.fullName || "Unknown Student"}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-xs text-muted-foreground text-center py-4">No students registered yet.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {isEditing && (
                        <DialogFooter className="p-6 pt-4 border-t flex-shrink-0">
                            <Button type="button" variant="ghost" onClick={resetForm} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md font-semibold">
                                {isPending ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                                ) : (
                                    <><CheckCircle2 className="mr-2 h-4 w-4" />Save Changes</>
                                )}
                            </Button>
                        </DialogFooter>
                    )}
                </form>
            </DialogContent>
        </Dialog>



        {/* Chain Edit Confirmation Dialog */}
        <Dialog open={showChainEditConfirm} onOpenChange={setShowChainEditConfirm}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle className="text-primary flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        Edit Recurring Session
                    </DialogTitle>
                    <DialogDescription>
                        This session is part of a recurring series. Which sessions should be updated?
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 pt-4">
                    <Button
                        variant="outline"
                        className="w-full h-14 justify-start text-left px-4 rounded-xl hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={executeSingleUpdate}
                        disabled={isPending}
                    >
                        <div>
                            <p className="font-semibold text-sm">This session only</p>
                            <p className="text-xs text-muted-foreground">Only update this specific occurrence</p>
                        </div>
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full h-14 justify-start text-left px-4 rounded-xl hover:border-primary/50 hover:text-primary transition-colors"
                        onClick={executeChainUpdate}
                        disabled={isPending}
                    >
                        <div>
                            <p className="font-semibold text-sm">This and all future sessions</p>
                            <p className="text-xs text-muted-foreground">Update this session and every occurrence after it</p>
                        </div>
                    </Button>
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="ghost" onClick={() => setShowChainEditConfirm(false)} disabled={isPending} className="rounded-full">
                        Cancel
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    )
}
