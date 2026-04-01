"use client"

import { useState, useMemo } from "react"
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
import { createGroupSession } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { Plus, CalendarIcon, Clock, Repeat } from "lucide-react"
import { toast } from "sonner"
import { format, eachDayOfInterval, addDays } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
            // Create a session for each date sequentially
            for (const d of datesToCreate) {
                const res = await createGroupSession(d, startTimeStr, topic, parseInt(maxStudents), supervisorId || undefined, durationMin, selectedStudents)
                if (!res.success) {
                    toast.error(`Error on ${format(d, "PP")}: ${res.error}`)
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
            toast.success(`Successfully created ${datesToCreate.length} session(s)!`)
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
                <Button className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    New Session
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Group Session</DialogTitle>
                </DialogHeader>

                <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="single" className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Single Session
                        </TabsTrigger>
                        <TabsTrigger value="bulk" className="flex items-center gap-2">
                            <Repeat className="h-4 w-4" />
                            Bulk Schedule
                        </TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {supervisors && supervisors.length > 0 && (
                            <div className="space-y-2">
                                <Label>Supervisor (Required for Office)</Label>
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
                            </div>
                        )}
                        
                        <div className="space-y-2">
                            <Label>Topic</Label>
                            <Input value={topic} onChange={e => setTopic(e.target.value)} required placeholder="e.g. Ethics" />
                        </div>

                        {mode === "single" ? (
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2 flex flex-col pt-2 max-w-full overflow-hidden">
                                    <Label>Date</Label>
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
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 flex flex-col pt-2 max-w-full overflow-hidden">
                                        <Label>Start Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                                    {startDate ? format(startDate, "PP") : <span>Pick start</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2 flex flex-col pt-2 max-w-full overflow-hidden">
                                        <Label>End Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-xs", !endDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                                    {endDate ? format(endDate, "PP") : <span>Pick end</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="space-y-2 pt-2">
                                    <Label>Repeats On</Label>
                                    <div className="flex justify-between items-center gap-1 sm:gap-2">
                                        {WEEKDAYS.map((day) => {
                                            const isSelected = weekdays.includes(day.value)
                                            return (
                                                <button
                                                    key={day.value}
                                                    type="button"
                                                    onClick={() => toggleWeekday(day.value)}
                                                    className={cn(
                                                        "h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center font-medium text-sm transition-all shadow-sm border",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground border-primary scale-105"
                                                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                    )}
                                                    title={day.fullLabel}
                                                >
                                                    {day.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="bg-muted p-4 rounded-xl border flex items-center justify-between text-sm">
                                    <span className="font-medium">Total Sessions to Create:</span>
                                    <span className="font-bold text-primary text-lg">{previewCount}</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 pt-2">
                            <Label>Service Window</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative flex items-center">
                                    <span className="absolute left-2 top-0.5 text-[8px] uppercase text-muted-foreground font-bold pointer-events-none z-10">Start</span>
                                    <Input
                                        type="time"
                                        required
                                        className="pt-4 pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                                <div className="relative flex items-center">
                                    <span className="absolute left-2 top-0.5 text-[8px] uppercase text-muted-foreground font-bold pointer-events-none z-10">End</span>
                                    <Input
                                        type="time"
                                        required
                                        className="pt-4 pr-10 relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-12 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
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
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-indigo-700 uppercase">Calculated Duration</span>
                            <span className="text-sm font-bold text-indigo-900">{(durationMin / 60).toFixed(2)} hours</span>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Max Students (Limit 10)</Label>
                                <Input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} max={10} min={1} required />
                            </div>
                        </div>
                        {students && students.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center mb-1">
                                    <Label>Select Students (Optional)</Label>
                                    <span className="text-xs text-muted-foreground">{selectedStudents.length} / {maxStudents}</span>
                                </div>
                                <Input
                                    placeholder="Search students..."
                                    value={studentSearch}
                                    onChange={e => setStudentSearch(e.target.value)}
                                    className="mb-2 h-8"
                                />
                                <div className="max-h-40 overflow-y-auto border rounded-md p-3 space-y-3">
                                    {students
                                        .filter(s => s.fullName.toLowerCase().includes(studentSearch.toLowerCase()))
                                        .map(student => (
                                            <div key={student.id} className="flex items-center space-x-2">
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
                                                />
                                                <Label htmlFor={`student-${student.id}`} className="font-normal cursor-pointer leading-none">{student.fullName}</Label>
                                            </div>
                                        ))}
                                    {students.filter(s => s.fullName.toLowerCase().includes(studentSearch.toLowerCase())).length === 0 && (
                                        <div className="text-sm text-muted-foreground text-center py-2">No students found</div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="pt-4 flex justify-end">
                            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="mr-2">Cancel</Button>
                            <Button type="submit" disabled={isPending || (mode === 'bulk' && previewCount === 0)}>{isPending ? "Creating..." : "Create Session(s)"}</Button>
                        </div>
                    </form>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
