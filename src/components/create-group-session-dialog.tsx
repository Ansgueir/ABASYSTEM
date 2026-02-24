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
import { createGroupSession } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { Plus, CalendarIcon } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface CreateGroupSessionDialogProps {
    supervisors?: { id: string, fullName: string }[]
}

export function CreateGroupSessionDialog({ supervisors }: CreateGroupSessionDialogProps = {}) {
    const [open, setOpen] = useState(false)
    const [topic, setTopic] = useState("")
    const [date, setDate] = useState<Date | undefined>(undefined)
    const [time, setTime] = useState("09:00")
    const [maxStudents, setMaxStudents] = useState("10")
    const [supervisorId, setSupervisorId] = useState("")
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        if (!date) {
            toast.error("Please select a date.")
            setIsPending(false)
            return
        }
        const res = await createGroupSession(date, time, topic, parseInt(maxStudents), supervisorId || undefined)
        setIsPending(false)
        if (res.success) {
            setOpen(false)
            setTopic("")
            setDate(undefined)
            toast.success("Session created!")
            router.refresh()
        } else {
            toast.error(res.error)
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Group Session</DialogTitle>
                </DialogHeader>
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
                    <div className="grid grid-cols-2 gap-4">
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
                        <div className="space-y-2">
                            <Label>Time</Label>
                            <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Max Students (Limit 10)</Label>
                        <Input type="number" value={maxStudents} onChange={e => setMaxStudents(e.target.value)} max={10} min={1} required />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="mr-2">Cancel</Button>
                        <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Session"}</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
