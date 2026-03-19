"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Users, Save, Loader2, ShieldCheck, UserPlus } from "lucide-react"
import { updateStudentAssignments } from "@/actions/assignments"
import { toast } from "sonner"

interface SupervisorAssignmentCardProps {
    studentId: string
    currentAssignments: {
        supervisorId: string
        isPrimary: boolean
        supervisor: {
            fullName: string
        }
    }[]
    allSupervisors: {
        id: string
        fullName: string
    }[]
}

export function SupervisorAssignmentCard({
    studentId,
    currentAssignments,
    allSupervisors
}: SupervisorAssignmentCardProps) {
    const primary = currentAssignments.find(a => a.isPrimary)
    const additionals = currentAssignments.filter(a => !a.isPrimary)

    const [primaryId, setPrimaryId] = useState<string>(primary?.supervisorId || "")
    const [additionalIds, setAdditionalIds] = useState<string[]>(additionals.map(a => a.supervisorId))
    const [isPending, startTransition] = useTransition()

    const handleAddAdditional = (supervisorId: string) => {
        if (!supervisorId || supervisorId === primaryId || additionalIds.includes(supervisorId)) return
        setAdditionalIds([...additionalIds, supervisorId])
    }

    const handleRemoveAdditional = (id: string) => {
        setAdditionalIds(additionalIds.filter(x => x !== id))
    }

    const handleSave = () => {
        if (!primaryId) {
            toast.error("A student must have a primary supervisor.")
            return
        }

        startTransition(async () => {
            const res = await updateStudentAssignments(studentId, primaryId, additionalIds)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervisor assignments updated successfully")
            }
        })
    }

    const isChanged = primaryId !== (primary?.supervisorId || "") || 
                      JSON.stringify([...additionalIds].sort()) !== JSON.stringify([...additionals.map(a => a.supervisorId)].sort())

    return (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-6 border-b bg-muted/30">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Supervisor Assignment
                    </h3>
                    {isChanged && (
                        <Button 
                            onClick={handleSave} 
                            disabled={isPending} 
                            size="sm"
                            className="h-8 gap-2 bg-primary hover:bg-primary/90"
                        >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Save Changes
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Select a primary supervisor and optionally add multiple additional supervisors.
                </p>
            </div>

            <div className="p-6 space-y-6 flex-1">
                {/* Primary Supervisor Select */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Primary Supervisor <span className="text-destructive">*</span>
                    </Label>
                    <Select value={primaryId} onValueChange={(val) => {
                        setPrimaryId(val)
                        // Ensure primary is not also in additionals
                        setAdditionalIds(prev => prev.filter(id => id !== val))
                    }}>
                        <SelectTrigger className="w-full h-10 rounded-lg">
                            <SelectValue placeholder="Select primary supervisor" />
                        </SelectTrigger>
                        <SelectContent>
                            {allSupervisors.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                    {s.fullName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-px bg-muted" />

                {/* Additional Supervisors Select */}
                <div className="space-y-4">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-primary" />
                        Additional Supervisors
                    </Label>
                    
                    <Select onValueChange={handleAddAdditional}>
                        <SelectTrigger className="w-full h-10 rounded-lg">
                            <SelectValue placeholder="Add an additional supervisor..." />
                        </SelectTrigger>
                        <SelectContent>
                            {allSupervisors
                                .filter(s => s.id !== primaryId && !additionalIds.includes(s.id))
                                .map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                        {s.fullName}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>

                    <div className="bg-muted/30 rounded-lg p-4 min-h-[100px] border border-dashed flex flex-wrap gap-2 content-start">
                        {additionalIds.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic w-full text-center mt-6">
                                No additional supervisors assigned.
                            </p>
                        ) : (
                            additionalIds.map(id => {
                                const sup = allSupervisors.find(s => s.id === id)
                                return (
                                    <Badge 
                                        key={id} 
                                        variant="secondary" 
                                        className="h-8 gap-1 pl-3 pr-1 py-1 rounded-lg text-sm bg-background border shadow-sm group hover:border-destructive/30 transition-all"
                                    >
                                        {sup?.fullName}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-5 w-5 p-0 rounded-md hover:bg-destructive hover:text-destructive-foreground opacity-50 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleRemoveAdditional(id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </Badge>
                                )
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
