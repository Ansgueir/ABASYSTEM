"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Check, X, Users, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { getManageableStudents, assignStudentToSupervisor } from "@/actions/assignments"

interface ManageStudentsProps {
    supervisorId: string
    supervisorName: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function ManageStudentsForm({ supervisorId, supervisorName }: ManageStudentsProps) {
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    const [unassigned, setUnassigned] = useState<any[]>([])
    const [assigned, setAssigned] = useState<any[]>([])
    const [searchAssignedTerm, setSearchAssignedTerm] = useState("")
    const [searchAvailableTerm, setSearchAvailableTerm] = useState("")

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
        setSearchAssignedTerm("")
        setSearchAvailableTerm("")
        fetchStudents()
    }, [supervisorId])

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

    const filteredAssigned = assigned.filter(s => 
        (s.fullName || "").toLowerCase().includes(searchAssignedTerm.toLowerCase()) || 
        (s.email || "").toLowerCase().includes(searchAssignedTerm.toLowerCase())
    )

    const filteredUnassigned = unassigned.filter(s => 
        (s.fullName || "").toLowerCase().includes(searchAvailableTerm.toLowerCase()) || 
        (s.email || "").toLowerCase().includes(searchAvailableTerm.toLowerCase())
    )

    return (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    {/* Assigned Section */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 text-muted-foreground flex justify-between uppercase tracking-wider">
                            Currently Assigned
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">
                                {assigned.length}
                            </span>
                        </h3>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search assigned by name or email..." 
                                className="pl-9 h-10 text-sm"
                                value={searchAssignedTerm}
                                onChange={(e) => setSearchAssignedTerm(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            {filteredAssigned.length === 0 ? (
                                <p className="text-sm text-center py-6 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                                    {searchAssignedTerm ? "No matches found" : "No students currently assigned"}
                                </p>
                            ) : (
                                filteredAssigned.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all group">
                                        <div>
                                            <p className="font-semibold text-sm">{student.fullName}</p>
                                            <p className="text-xs text-muted-foreground tracking-tight">{student.email}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-8 opacity-90 group-hover:opacity-100"
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
                        <h3 className="font-semibold text-sm mb-3 text-muted-foreground flex justify-between uppercase tracking-wider">
                            Available Unassigned Students
                            <span className="bg-muted px-2 py-0.5 rounded-full text-xs font-mono">
                                {unassigned.length}
                            </span>
                        </h3>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search available by name or email..." 
                                className="pl-9 h-10 text-sm"
                                value={searchAvailableTerm}
                                onChange={(e) => setSearchAvailableTerm(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            {filteredUnassigned.length === 0 ? (
                                <p className="text-sm text-center py-6 border border-dashed rounded-lg text-muted-foreground bg-muted/20">
                                    {searchAvailableTerm ? "No matches found" : "No unassigned students available"}
                                </p>
                            ) : (
                                filteredUnassigned.map(student => (
                                    <div key={student.id} className="flex items-center justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all group">
                                        <div>
                                            <p className="font-semibold text-sm">{student.fullName}</p>
                                            <p className="text-xs text-muted-foreground tracking-tight">{student.email}</p>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="rounded-full h-8 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-colors opacity-90 group-hover:opacity-100"
                                            onClick={() => handleAssignToggle(student.id, "unassigned")}
                                            disabled={isPending}
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            Assign
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export function ManageStudentsDialog({ supervisorId, supervisorName, open: controlledOpen, onOpenChange: controlledOnOpenChange }: ManageStudentsProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const onOpenChange = controlledOnOpenChange || setInternalOpen

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                        <Users className="h-4 w-4" />
                        Manage Students
                    </Button>
                </DialogTrigger>
            )}
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
                <div className="mt-4 overflow-hidden flex-1 flex flex-col">
                    <ManageStudentsForm supervisorId={supervisorId} supervisorName={supervisorName} />
                    <div className="mt-6 pt-4 border-t flex justify-end">
                        <Button variant="outline" className="rounded-full px-6" onClick={() => onOpenChange(false)}>Close</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
