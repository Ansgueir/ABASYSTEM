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

type DraftChange = {
    studentId: string
    name: string
    action: 'assign' | 'remove'
    startDate: string
}

export function ManageGroupForm({ supervisorId, supervisorName }: ManageGroupProps) {
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    
    // Master data
    const [initialUnassigned, setInitialUnassigned] = useState<any[]>([])
    const [initialAssigned, setInitialAssigned] = useState<any[]>([])
    
    // Local state data
    const [unassigned, setUnassigned] = useState<any[]>([])
    const [assigned, setAssigned] = useState<any[]>([])
    const [searchAssignedTerm, setSearchAssignedTerm] = useState("")
    const [searchAvailableTerm, setSearchAvailableTerm] = useState("")
    
    // Drafts
    const [pendingChanges, setPendingChanges] = useState<Record<string, DraftChange>>({})
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

    const fetchStudents = async () => {
        setIsLoading(true)
        const res = await getGroupStudents(supervisorId)
        if (res.error) {
            toast.error(res.error)
        } else {
            setInitialUnassigned(res.unassigned || [])
            setInitialAssigned(res.assigned || [])
            setUnassigned(res.unassigned || [])
            setAssigned(res.assigned || [])
            setPendingChanges({})
        }
        setIsLoading(false)
    }

    useEffect(() => {
        setSearchAssignedTerm("")
        setSearchAvailableTerm("")
        fetchStudents()
    }, [supervisorId])

    const getLocalDateString = () => {
        const d = new Date()
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    }

    const handleToggle = (studentId: string, studentName: string, action: 'assign' | 'remove') => {
        if (action === 'assign') {
            const s = unassigned.find(x => x.id === studentId)
            if (!s) return
            setUnassigned(prev => prev.filter(x => x.id !== studentId))
            setAssigned(prev => [...prev, s])
            
            setPendingChanges(prev => {
                const next = { ...prev }
                if (initialAssigned.some(x => x.id === studentId)) {
                    delete next[studentId] // Reverted
                } else {
                    next[studentId] = { studentId, name: studentName, action, startDate: getLocalDateString() }
                }
                return next
            })
        } else {
            const s = assigned.find(x => x.id === studentId)
            if (!s) return
            setAssigned(prev => prev.filter(x => x.id !== studentId))
            setUnassigned(prev => [...prev, s])
            
            setPendingChanges(prev => {
                const next = { ...prev }
                if (initialUnassigned.some(x => x.id === studentId)) {
                    delete next[studentId] // Reverted
                } else {
                    next[studentId] = { studentId, name: studentName, action, startDate: getLocalDateString() }
                }
                return next
            })
        }
    }

    const updateStartDate = (studentId: string, value: string) => {
        setPendingChanges(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], startDate: value }
        }))
    }

    const executeRun = () => {
        const changes = Object.values(pendingChanges)
        if (changes.length === 0) return
        
        startTransition(async () => {
            let errorCount = 0
            for (const change of changes) {
                // Here we pass the action, but currently assignments.ts doesn't support startDate yet.
                // We keep it functionally same to DB while reflecting UI requirement.
                const res = await toggleGroupStudentAssignment(change.studentId, supervisorId, change.action)
                if (res.error) {
                    toast.error(`Error on ${change.name}: ${res.error}`)
                    errorCount++
                }
            }
            if (errorCount === 0) {
                toast.success("Groups successfully updated!")
                setIsUpdateModalOpen(false)
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

    const pendingArray = Object.values(pendingChanges)

    return (
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            <div className="flex justify-end gap-3 mb-6 border-b pb-4">
                <Button 
                    variant="default" 
                    className="px-6 relative"
                    onClick={() => {
                        if (pendingArray.length === 0) return toast("No pending modifications.")
                        setIsUpdateModalOpen(true)
                    }}
                >
                    Update
                    {pendingArray.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                            {pendingArray.length}
                        </span>
                    )}
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
                                            onClick={() => handleToggle(student.id, student.fullName, 'remove')}
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
                                            onClick={() => handleToggle(student.id, student.fullName, 'assign')}
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

            {/* Update Modal */}
            <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
                <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[85vh]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Check className="h-5 w-5 text-primary" />
                            Confirm Group Modifications
                        </DialogTitle>
                        <DialogDescription>
                            Review the students added or removed from this group and finalize their start dates.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-2 space-y-3 overflow-y-auto pr-2 mt-2">
                        {pendingArray.length === 0 ? (
                            <p className="text-sm text-center py-6 text-muted-foreground">No pending modifications.</p>
                        ) : (
                            pendingArray.map((draft, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:shadow-sm">
                                    <div className="flex-1 truncate">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-sm truncate">{draft.name}</p>
                                            {draft.action === 'remove' ? (
                                                <span className="text-[9px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Removing</span>
                                            ) : (
                                                <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Assigning</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                            Fecha Inicio:
                                        </span>
                                        <Input 
                                            value={draft.startDate} 
                                            onChange={(e) => updateStartDate(draft.studentId, e.target.value)}
                                            className="w-32 h-9 text-sm text-center font-medium bg-muted/50 focus:bg-background"
                                            placeholder="MM/DD/YYYY"
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                        <Button 
                            variant="outline" 
                            className="rounded-full px-6"
                            onClick={() => setIsUpdateModalOpen(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={executeRun}
                            disabled={isPending}
                            className="rounded-full px-8"
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Run Updates
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
