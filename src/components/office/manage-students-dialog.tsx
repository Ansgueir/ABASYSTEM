"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Check, X, Users, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getManageableStudents, assignStudentToSupervisor } from "@/actions/assignments"

interface ManageStudentsDialogProps {
    supervisorId: string
    supervisorName: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ManageStudentsDialog({ supervisorId, supervisorName, open, onOpenChange }: ManageStudentsDialogProps) {
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    const [unassigned, setUnassigned] = useState<any[]>([])
    const [assigned, setAssigned] = useState<any[]>([])

    const fetchStudents = async () => {
        setIsLoading(true)
        const res = await getManageableStudents(supervisorId)
        if (res.error) {
            toast.error(res.error)
        } else {
            setUnassigned(res.unassigned || [])
            setAssigned(res.assigned || [])
        }
        setIsLoading(false)
    }

    useEffect(() => {
        if (open) {
            fetchStudents()
        }
    }, [open, supervisorId])

    const handleAssignToggle = (studentId: string, currentStatus: "assigned" | "unassigned") => {
        startTransition(async () => {
            const newSupervisorId = currentStatus === "assigned" ? null : supervisorId
            const res = await assignStudentToSupervisor(studentId, newSupervisorId)

            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(currentStatus === "assigned" ? "Student removed" : "Student assigned")
                fetchStudents()
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Manage Students for {supervisorName}
                    </DialogTitle>
                    <DialogDescription>
                        Assign unassigned students or remove currently assigned ones.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-6">
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Assigned Section */}
                            <div>
                                <h3 className="font-semibold text-sm mb-3 text-muted-foreground flex justify-between">
                                    CURRENTLY ASSIGNED
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
                                        {assigned.length}
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                    {assigned.length === 0 ? (
                                        <p className="text-sm text-center py-4 bg-muted/50 rounded-lg text-muted-foreground">
                                            No students currently assigned
                                        </p>
                                    ) : (
                                        assigned.map(student => (
                                            <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                                <div>
                                                    <p className="font-medium text-sm">{student.fullName}</p>
                                                    <p className="text-xs text-muted-foreground">{student.email}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleAssignToggle(student.id, "assigned")}
                                                    disabled={isPending}
                                                >
                                                    <X className="h-4 w-4 mr-1" />
                                                    Remove
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Unassigned Section */}
                            <div>
                                <h3 className="font-semibold text-sm mb-3 text-muted-foreground flex justify-between">
                                    AVAILABLE UNASSIGNED STUDENTS
                                    <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
                                        {unassigned.length}
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                    {unassigned.length === 0 ? (
                                        <p className="text-sm text-center py-4 bg-muted/50 rounded-lg text-muted-foreground">
                                            No unassigned students available
                                        </p>
                                    ) : (
                                        unassigned.map(student => (
                                            <div key={student.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                                <div>
                                                    <p className="font-medium text-sm">{student.fullName}</p>
                                                    <p className="text-xs text-muted-foreground">{student.email}</p>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleAssignToggle(student.id, "unassigned")}
                                                    disabled={isPending}
                                                >
                                                    <Check className="h-4 w-4 mr-1" />
                                                    Assign Component
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="mt-4 flex justify-end">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
