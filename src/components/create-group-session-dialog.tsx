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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGroupSession } from "@/actions/groups"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"

export function CreateGroupSessionDialog() {
    const [open, setOpen] = useState(false)
    const [topic, setTopic] = useState("")
    const [date, setDate] = useState("")
    const [time, setTime] = useState("09:00")
    const [maxStudents, setMaxStudents] = useState("10")
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        const res = await createGroupSession(new Date(date), time, topic, parseInt(maxStudents))
        setIsPending(false)
        if (res.success) {
            setOpen(false)
            setTopic("")
            setDate("")
            router.refresh()
            alert("Session created!")
        } else {
            alert("Error: " + res.error)
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
                    <div className="space-y-2">
                        <Label>Topic</Label>
                        <Input value={topic} onChange={e => setTopic(e.target.value)} required placeholder="e.g. Ethics" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
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
