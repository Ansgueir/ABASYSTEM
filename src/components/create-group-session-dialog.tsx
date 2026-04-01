"use client"

import { useState, useMemo } from "react"
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
import { createGroupSession } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { Plus, CalendarIcon, Clock, Repeat, Zap, CheckCircle2, Loader2, Users } from "lucide-react"
import { toast } from "sonner"
import { format, eachDayOfInterval, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"

const WEEKDAYS = [
    { label: "S", fullLabel: "Sunday", value: 0 },
    { label: "M", fullLabel: "Monday", value: 1 },
    { label: "T", fullLabel: "Tuesday", value: 2 },
    { label: "W", fullLabel: "Wednesday", value: 3 },
    { label: "T", fullLabel: "Thursday", value: 4 },
    { label: "F", fullLabel: "Friday", value: 5 },
    { label: "S", fullLabel: "Saturday", value: 6 },
]

interface CreateGroupSessionDialogProps {
    supervisors?: { id: string, fullName: string }[]
    students?: { id: string, fullName: string }[]
}

export function CreateGroupSessionDialog({ supervisors, students }: CreateGroupSessionDialogProps = {}) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<"single" | "bulk">("single")
    const [topic, setTopic] = useState("")
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [startDate, setStartDate] = useState<Date | undefined>(new Date())
    const [endDate, setEndDate] = useState<Date | undefined>(addDays(new Date(), 7))
    const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5])
    
    const [startTimeStr, setStartTimeStr] = useState("09:00")
    const [endTimeStr, setEndTimeStr] = useState("10:00")
    const [maxStudents, setMaxStudents] = useState("10")
    const [durationMin, setDurationMin] = useState(60)
    const [selectedStudents, setSelectedStudents] = useState<string[]>([])
    const [studentSearch, setStudentSearch] = useState("")
    const [supervisorId, setSupervisorId] = useState("")
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    const previewCount = useMemo(() => {
        if (mode !== "bulk" || !startDate || !endDate || weekdays.length === 0) return 0
        if (startDate > endDate) return 0
        const days = eachDayOfInterval({ start: startDate, end: endDate })
        return days.filter(d => weekdays.includes(d.getDay())).length
    }, [mode, startDate, endDate, weekdays])

    const toggleWeekday = (dayValue: number) => {
        const updated = weekdays.includes(dayValue)
            ? weekdays.filter(d => d !== dayValue)
            : [...weekdays, dayValue]
        setWeekdays(updated)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)

        if (mode === "single" && !date) {
            toast.error("Please pick a date.")
            setIsPending(false)
            return
        }

        if (mode === "bulk" && (!startDate || !endDate || weekdays.length === 0)) {
            toast.error("Please select a valid date range and at least one weekday.")
            setIsPending(false)
            return
        }

        if (durationMin <= 0) {
            toast.error("End time must be after start time.")
            setIsPending(false)
            return
        }

        let datesToCreate: Date[] = []
        if (mode === "single") {
            datesToCreate.push(date!)
        } else {
            datesToCreate = eachDayOfInterval({ start: startDate!, end: endDate! })
                .filter(d => weekdays.includes(d.getDay()))
        }

        if (datesToCreate.length === 0) {
            toast.error("No valid dates found in the specified range.")
            setIsPending(false)
            return
        }

        try {
            for (const d of datesToCreate) {
                const res = await createGroupSession(d, startTimeStr, topic, parseInt(maxStudents), supervisorId || undefined, durationMin, selectedStudents)
                if (!res.success) {
                    toast.error(`Error on ${format(d, "PP")}: ${res.error}`)
                    setIsPending(false)
                    return
                }
            }

            setOpen(false)
            setTopic("")
            setDate(new Date())
            setStartTimeStr("09:00")
            setEndTimeStr("10:00")
            setDurationMin(60)
            setSelectedStudents([])
            setStudentSearch("")
            toast.success(`✅ Successfully created ${datesToCreate.length} session(s)!`)
            router.refresh()
        } catch (error) {
            console.error("Bulk creation error:", error)
            toast.error("An unexpected error occurred.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    New Session
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-500" />
                        Create Group Session
                    </DialogTitle>
                    <DialogDescription>
                        Schedule a single group session or create a recurring schedule.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                        type="button"
                        onClick={() => setMode("single")}
                        className={cn(
                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                            mode === "single"
                                ? "border-indigo-500 bg-indigo-500/10 text-indigo-600"
                                : "border-border text-muted-foreground hover:border-indigo-300"
                        )}
                    >
                        <Clock className="h-4 w-4" />
                        Single Session
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("bulk")}
                        className={cn(
                            "flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all",
                            mode === "bulk"
                                ? "border-violet-500 bg-violet-500/10 text-violet-600"
                                : "border-border text-muted-foreground hover:border-violet-300"
                        )}
                    >
                        <Repeat className="h-4 w-4" />
                        Recurring Schedule
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {supervisors && supervisors.length > 0 && (
                        <div className="space-y-2">
                            <Label>Supervisor</Label>
                            <Select onValueChange={setSupervisorId} value={supervisorId} required>
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue placeholder="Select supervisor..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {supervisors.map(sup => (
                                        <SelectItem key={sup.id} value={sup.id}>{sup.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    
                    <div className="space-y-2">
                        <Label>Topic / Description</Label>
                        <Input 
                            value={topic} 
                            onChange={e => setTopic(e.target.value)} 
                            required 
                            placeholder="Short description of the session..." 
                            className="rounded-xl bg-muted/30 border-muted-foreground/20 focus:bg-background transition-all"
                        />
                    </div>

                    {mode === "single" ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Date of Service</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full pl-3 text-left font-normal rounded-xl",
                                                !date && "text-muted-foreground"
                                            )}
                                        >
                                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Start</Label>
                                    <div className="relative flex items-center">
                                        <Input
                                            type="time"
                                            required
                                            className="rounded-xl pr-8 md:pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                                <div className="space-y-2">
                                    <Label>End</Label>
                                    <div className="relative flex items-center">
                                        <Input
                                            type="time"
                                            required
                                            className="rounded-xl pr-8 md:pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full pl-3 text-left font-normal rounded-xl", !startDate && "text-muted-foreground")}>
                                                {startDate ? format(startDate, "PP") : <span>Pick start</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full pl-3 text-left font-normal rounded-xl", !endDate && "text-muted-foreground")}>
                                                {endDate ? format(endDate, "PP") : <span>Pick end</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Start Time</Label>
                                    <div className="relative flex items-center">
                                        <Input
                                            type="time"
                                            required
                                            className="rounded-xl pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                                <div className="space-y-2">
                                    <Label>End Time</Label>
                                    <div className="relative flex items-center">
                                        <Input
                                            type="time"
                                            required
                                            className="rounded-xl pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                            </div>

                            <div>
                                <p className="text-sm font-medium mb-2">Repeat on Days</p>
                                <div className="flex gap-1.5 flex-wrap">
                                    {WEEKDAYS.map((day) => (
                                        <button
                                            key={day.value}
                                            type="button"
                                            title={day.fullLabel}
                                            onClick={() => toggleWeekday(day.value)}
                                            className={cn(
                                                "h-9 w-9 rounded-full text-xs font-bold transition-all border-2",
                                                weekdays.includes(day.value)
                                                    ? "bg-violet-500 border-violet-500 text-white shadow-md"
                                                    : "border-border text-muted-foreground hover:border-violet-300"
                                            )}
                                        >
                                            {day.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {previewCount > 0 && (
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                    <Zap className="h-4 w-4 text-violet-500 shrink-0" />
                                    <p className="text-sm text-violet-700 dark:text-violet-300 font-medium">
                                        Will generate <span className="font-bold">{previewCount} logs</span> totaling <span className="font-bold">{(durationMin / 60 * previewCount).toFixed(1)}h</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Session Duration Summary Bar */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted border">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium text-muted-foreground">Session Duration</span>
                        </div>
                        <span className="text-sm font-bold text-indigo-600">
                            {durationMin} min / {(durationMin / 60).toFixed(2)} hrs
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 pt-1">
                        <div className="space-y-2">
                            <Label>Max Students (Limit 10)</Label>
                            <Input 
                                type="number" 
                                value={maxStudents} 
                                onChange={e => setMaxStudents(e.target.value)} 
                                max={10} 
                                min={1} 
                                required 
                                className="rounded-xl bg-muted/20 border-muted-foreground/20"
                            />
                        </div>
                    </div>

                    {students && students.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-center mb-1">
                                <Label className="text-sm font-semibold">Select Students (Optional)</Label>
                                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                                    {selectedStudents.length} / {maxStudents}
                                </span>
                            </div>
                            <Input
                                placeholder="Search students by name..."
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                                className="mb-2 h-9 rounded-xl border-dashed"
                            />
                            <div className="max-h-40 overflow-y-auto border rounded-xl p-3 space-y-3 bg-muted/10">
                                {students
                                    .filter(s => s.fullName.toLowerCase().includes(studentSearch.toLowerCase()))
                                    .map(student => (
                                        <div key={student.id} className="flex items-center space-x-2 p-1 rounded-md hover:bg-muted/30 transition-colors">
                                            <Checkbox
                                                id={`student-${student.id}`}
                                                checked={selectedStudents.includes(student.id)}
                                                disabled={!selectedStudents.includes(student.id) && selectedStudents.length >= parseInt(maxStudents || "10")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        if (selectedStudents.length < parseInt(maxStudents || "10")) {
                                                            setSelectedStudents([...selectedStudents, student.id])
                                                        }
                                                    } else {
                                                        setSelectedStudents(selectedStudents.filter(id => id !== student.id))
                                                    }
                                                }}
                                                className="rounded-md border-indigo-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                                            />
                                            <Label htmlFor={`student-${student.id}`} className="font-normal cursor-pointer text-sm flex-1">{student.fullName}</Label>
                                        </div>
                                    ))}
                                {students.filter(s => s.fullName.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                                    <div className="text-sm text-muted-foreground text-center py-4">No students found</div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button 
                            type="submit" 
                            disabled={isPending || (mode === 'bulk' && previewCount === 0)}
                            className={cn(
                                "rounded-xl font-semibold shadow-md",
                                mode === "bulk" ? "bg-violet-600 hover:bg-violet-700 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                            )}
                        >
                            {isPending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                            ) : mode === 'bulk' ? (
                                <><CheckCircle2 className="mr-2 h-4 w-4" />Generate {previewCount} Sessions</>
                            ) : (
                                "Save Session"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
