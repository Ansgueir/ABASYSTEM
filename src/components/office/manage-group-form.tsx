"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2, Search } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { getGroupStudents, toggleGroupStudentAssignment } from "@/actions/assignments"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

interface ManageGroupProps {
    supervisorId: string
    supervisorName: string
}

export function ManageGroupForm({ supervisorId, supervisorName }: ManageGroupProps) {
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    const [unassigned, setUnassigned] = useState<any[]>([])
    const [assigned, setAssigned] = useState<any[]>([])
    const [searchAssignedTerm, setSearchAssignedTerm] = useState("")
    const [searchAvailableTerm, setSearchAvailableTerm] = useState("")
    const [confirmData, setConfirmData] = useState<{ studentId: string; studentName: string; action: 'assign' | 'remove' } | null>(null)
    const [confirmInput, setConfirmInput] = useState("")

    const fetchStudents = async () => {
        setIsLoading(true)
        const res = await getGroupStudents(supervisorId)
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

    const handleAssignToggle = (studentId: string, studentName: string, action: 'assign' | 'remove') => {
        setConfirmData({ studentId, studentName, action })
        setConfirmInput("")
    }

    const executeToggle = () => {
        if (!confirmData) return
        
        startTransition(async () => {
            const res = await toggleGroupStudentAssignment(confirmData.studentId, supervisorId, confirmData.action)

            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success(confirmData.action === "remove" ? "Student removed from group" : "Student assigned to group")
                setConfirmData(null)
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
            <div className="flex justify-end gap-3 mb-6 border-b pb-4">
                <Button variant="default" className="px-6">
                    Update
                </Button>
                <Button variant="default" className="px-6">
                    Program
                </Button>
            </div>

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
                                    {searchAssignedTerm ? "No matches found" : "No students currently assigned to this group"}
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
                                            onClick={() => handleAssignToggle(student.id, student.fullName, 'remove')}
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
                                            onClick={() => handleAssignToggle(student.id, student.fullName, 'assign')}
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

            {/* Confirmation Modal */}
            <Dialog open={!!confirmData} onOpenChange={(open) => !open && setConfirmData(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>
                            {confirmData?.action === 'remove' ? 'Remove Group Assignment' : 'Assign Student to Group'}
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to {confirmData?.action} <strong>{confirmData?.studentName}</strong>?
                            <br />
                            This will {confirmData?.action === 'remove' ? 'detach them from' : 'assign them to'} the group supervision under {supervisorName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <p className="text-sm font-medium">To confirm, please type <span className="font-bold uppercase">"{confirmData?.action}"</span> below:</p>
                        <Input 
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value.toLowerCase())}
                            placeholder={`Type ${confirmData?.action}...`}
                            className="h-10 text-center font-bold"
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className="flex-1 rounded-full" 
                            onClick={() => setConfirmData(null)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant={confirmData?.action === 'remove' ? 'destructive' : 'default'}
                            className="flex-1 rounded-full" 
                            onClick={executeToggle}
                            disabled={isPending || confirmInput !== confirmData?.action}
                        >
                            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm {confirmData?.action}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
