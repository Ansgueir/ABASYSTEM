"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Pencil, Loader2, Save } from "lucide-react"
import { updateStudentNotes } from "@/actions/supervisor-notes"
import { toast } from "sonner"

interface EditNotesDialogProps {
    studentId: string
    initialNotes: string
}

export function EditNotesDialog({ studentId, initialNotes }: EditNotesDialogProps) {
    const [open, setOpen] = useState(false)
    const [notes, setNotes] = useState(initialNotes)
    const [isPending, startTransition] = useTransition()

    function handleSave() {
        startTransition(async () => {
            const res = await updateStudentNotes(studentId, notes)
            if (res.success) {
                toast.success("Notes updated successfully")
                setOpen(false)
            } else {
                toast.error(res.error || "Failed to update notes")
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-yellow-100/50">
                    <Pencil className="h-4 w-4 text-yellow-700" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Supervisor Notes</DialogTitle>
                    <DialogDescription>
                        These notes are private and shared only with the Office staff. Students CANNOT see these notes.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        placeholder="Write your notes about this student here..."
                        className="min-h-[200px] border-yellow-200 focus-visible:ring-yellow-400 bg-yellow-50/20"
                        value={notes}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isPending}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Notes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
