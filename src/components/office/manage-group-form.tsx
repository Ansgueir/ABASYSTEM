"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Check, X, Loader2, Search, Calendar, Plus, Users, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
    fetchSupervisorGroups,
    createSupervisorGroup,
    updateSupervisorGroup,
    deleteSupervisorGroup,
    getStudentsByGroup,
    toggleStudentGroupAssignment,
} from "@/actions/group-assignments"
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

type GroupOption = {
    id: string
    name: string
}

export function ManageGroupForm({ supervisorId, supervisorName }: ManageGroupProps) {
    const [isPending, startTransition] = useTransition()
    const [isLoading, setIsLoading] = useState(false)
    
    // Groups
    const [groups, setGroups] = useState<GroupOption[]>([])
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
    const [isCreatingGroup, setIsCreatingGroup] = useState(false)
    const [isEditingGroup, setIsEditingGroup] = useState(false)
    const [newGroupName, setNewGroupName] = useState("")
    const [editGroupName, setEditGroupName] = useState("")
    
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
    const [isProgramModalOpen, setIsProgramModalOpen] = useState(false)
    const [recurrenceType, setRecurrenceType] = useState<'current' | 'multiple'>('current')
    const [monthsForward, setMonthsForward] = useState("1")
    const [programStart, setProgramStart] = useState("19:00")
    const [programEnd, setProgramEnd] = useState("20:30")

    // ─── Load Groups ───
    const loadGroups = async () => {
        const res = await fetchSupervisorGroups(supervisorId)
        if (res.error) {
            toast.error(res.error)
        } else {
            const list = (res.groups || []) as GroupOption[]
            setGroups(list)
            if (list.length > 0 && !selectedGroupId) {
                setSelectedGroupId(list[0].id)
            }
        }
    }

    useEffect(() => {
        setSelectedGroupId(null)
        setGroups([])
        setAssigned([])
        setUnassigned([])
        setPendingChanges({})
        loadGroups()
    }, [supervisorId])

    // ─── Load Students when group changes ───
    const fetchStudents = async (groupId: string) => {
        setIsLoading(true)
        const res = await getStudentsByGroup(groupId)
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
        if (selectedGroupId) {
            setSearchAssignedTerm("")
            setSearchAvailableTerm("")
            fetchStudents(selectedGroupId)
        } else {
            setAssigned([])
            setUnassigned([])
            setPendingChanges({})
        }
    }, [selectedGroupId])

    // ─── Create Group ───
    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) return toast.error("Group name cannot be empty.")
        const res = await createSupervisorGroup(supervisorId, newGroupName.trim())
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Group "${newGroupName.trim()}" created.`)
            setNewGroupName("")
            setIsCreatingGroup(false)
            await loadGroups()
            if (res.group) setSelectedGroupId(res.group.id)
        }
    }

    // ─── Helpers ───
    const getLocalDateString = () => {
        const d = new Date()
        return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`
    }

    const handleToggle = (studentId: string, studentName: string, action: 'assign' | 'remove') => {
        // Enforce max 10 on assign (local check)
        if (action === 'assign' && assigned.length >= 10) {
            return toast.error("Maximum capacity (10 students) reached for this group.")
        }

        if (action === 'assign') {
            const s = unassigned.find(x => x.id === studentId)
            if (!s) return
            setUnassigned(prev => prev.filter(x => x.id !== studentId))
            setAssigned(prev => [...prev, s])
            
            setPendingChanges(prev => {
                const next = { ...prev }
                if (initialAssigned.some(x => x.id === studentId)) {
                    delete next[studentId]
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
                    delete next[studentId]
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
        if (!selectedGroupId) return toast.error("No group selected.")
        const changes = Object.values(pendingChanges)
        if (changes.length === 0) return
        
        startTransition(async () => {
            let errorCount = 0
            for (const change of changes) {
                const res = await toggleStudentGroupAssignment(selectedGroupId, change.studentId, change.action, change.startDate)
                if (res.error) {
                    toast.error(`Error on ${change.name}: ${res.error}`)
                    errorCount++
                }
            }
            if (errorCount === 0) {
                toast.success("Group successfully updated!")
                setIsUpdateModalOpen(false)
                fetchStudents(selectedGroupId)
            }
        })
    }

    const handleProgramRun = async () => {
        if (!selectedGroupId) return toast.error("No group selected.")
        toast.success(`Group session programmed from ${programStart} to ${programEnd}`)
        setIsProgramModalOpen(false)
    }

    // ─── Filters ───
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
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 pt-2">
            {/* ─── Group Selector Bar ─── */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                    {isEditingGroup && selectedGroupId ? (
                        <div className="flex items-center gap-2">
                            <Input
                                value={editGroupName}
                                onChange={e => setEditGroupName(e.target.value)}
                                placeholder="Rename group"
                                className="h-10 text-sm flex-1"
                                onKeyDown={async e => {
                                    if (e.key === 'Enter' && editGroupName.trim()) {
                                        const res = await updateSupervisorGroup(selectedGroupId, editGroupName.trim())
                                        if (res.error) { toast.error(res.error) } else {
                                            toast.success("Group renamed.")
                                            setIsEditingGroup(false)
                                            await loadGroups()
                                        }
                                    }
                                }}
                                autoFocus
                            />
                            <Button size="sm" className="h-10 px-3" onClick={async () => {
                                if (!editGroupName.trim()) return
                                const res = await updateSupervisorGroup(selectedGroupId, editGroupName.trim())
                                if (res.error) { toast.error(res.error) } else {
                                    toast.success("Group renamed.")
                                    setIsEditingGroup(false)
                                    await loadGroups()
                                }
                            }}>
                                <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-10 px-3" onClick={() => setIsEditingGroup(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : groups.length > 0 ? (
                        <Select value={selectedGroupId || ""} onValueChange={setSelectedGroupId}>
                            <SelectTrigger className="w-full bg-background border h-10 font-medium">
                                <SelectValue placeholder="Select a group..." />
                            </SelectTrigger>
                            <SelectContent>
                                {groups.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <p className="text-sm text-muted-foreground">No groups created yet for this supervisor.</p>
                    )}
                </div>

                {/* Edit / Delete / New buttons */}
                {!isCreatingGroup && !isEditingGroup && selectedGroupId && (
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 w-10 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => {
                                const current = groups.find(g => g.id === selectedGroupId)
                                setEditGroupName(current?.name || "")
                                setIsEditingGroup(true)
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-10 w-10 p-0 text-muted-foreground hover:text-destructive"
                            onClick={async () => {
                                if (!confirm("Are you sure you want to delete this group? All student assignments in this group will be removed.")) return
                                const res = await deleteSupervisorGroup(selectedGroupId)
                                if (res.error) { toast.error(res.error) } else {
                                    toast.success("Group deleted.")
                                    setSelectedGroupId(null)
                                    await loadGroups()
                                }
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {isCreatingGroup ? (
                    <div className="flex items-center gap-2">
                        <Input
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            placeholder="Group Name"
                            className="h-10 w-44 text-sm"
                            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                            autoFocus
                        />
                        <Button size="sm" className="h-10 px-3" onClick={handleCreateGroup}>
                            <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-10 px-3" onClick={() => { setIsCreatingGroup(false); setNewGroupName("") }}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : !isEditingGroup && (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-10 gap-1.5 shrink-0"
                        onClick={() => setIsCreatingGroup(true)}
                    >
                        <Plus className="h-4 w-4" />
                        New Group
                    </Button>
                )}
            </div>

            {/* ─── Action Buttons ─── */}
            {selectedGroupId && (
                <>
                    <div className="flex justify-between items-center mb-2 border-b pb-4">
                        <p className="text-xs text-muted-foreground font-medium">
                            Assigned: <span className="text-primary font-bold">{assigned.length}</span> / 10 max
                        </p>
                        <div className="flex gap-3">
                            <Button 
                                variant="default" 
                                className="px-6 gap-2"
                                onClick={() => {
                                    if (pendingArray.length === 0) return toast("No pending modifications.")
                                    setIsUpdateModalOpen(true)
                                }}
                            >
                                Update
                                {pendingArray.length > 0 && (
                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-primary shadow-sm">
                                        {pendingArray.length}
                                    </span>
                                )}
                            </Button>
                            <Button 
                                variant="default" 
                                className="px-6"
                                onClick={() => setIsProgramModalOpen(true)}
                            >
                                Program
                            </Button>
                        </div>
                    </div>

                    {/* ─── Student Lists ─── */}
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
                                            Start Date:
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

            {/* Program Modal */}
            <Dialog open={isProgramModalOpen} onOpenChange={setIsProgramModalOpen}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" />
                            Program Group Session
                        </DialogTitle>
                        <DialogDescription>
                            Configure the default parameters for the supervision sessions.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center block">Duration</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button 
                                            variant={recurrenceType === 'current' ? 'default' : 'outline'}
                                            onClick={() => setRecurrenceType('current')}
                                            className="w-full text-[11px] px-1"
                                        >
                                            Current Only
                                        </Button>
                                        <Button 
                                            variant={recurrenceType === 'multiple' ? 'default' : 'outline'}
                                            onClick={() => setRecurrenceType('multiple')}
                                            className="w-full text-[10px] px-1 font-bold tracking-tight"
                                        >
                                            + Add Future
                                        </Button>
                                    </div>
                                </div>

                                {recurrenceType === 'multiple' && (
                                    <div className="space-y-2 animate-in fade-in zoom-in duration-200">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-center block">Additional Months</label>
                                        <Input 
                                            type="number" 
                                            min="1" 
                                            max="24"
                                            value={monthsForward}
                                            onChange={(e) => setMonthsForward(e.target.value)}
                                            className="h-10 text-center font-bold text-lg bg-muted/50 border shadow-inner"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center block">Start Time</label>
                                    <Input 
                                        type="time" 
                                        value={programStart}
                                        onChange={(e) => setProgramStart(e.target.value)}
                                        className="h-10 text-center font-medium bg-background border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-center block">End Time</label>
                                    <Input 
                                        type="time" 
                                        value={programEnd}
                                        onChange={(e) => setProgramEnd(e.target.value)}
                                        className="h-10 text-center font-medium bg-background border"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t mt-2">
                        <Button 
                            variant="outline" 
                            className="rounded-full px-6"
                            onClick={() => setIsProgramModalOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleProgramRun}
                            className="rounded-full px-8"
                        >
                            Run
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
