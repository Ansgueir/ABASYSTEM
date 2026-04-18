"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Loader2, Star, Users, Calendar, Clock, Check, AlertTriangle } from "lucide-react"
import { createContract, updateContract } from "@/actions/contracts"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface IndividualOption {
    id: string
    fullName: string
    bacbId: string
    credentialType: string
    currentStudents: number
    maxStudents: number
}

interface GroupOption {
    supervisorId: string
    supervisorName: string
    credentialType: string
    groupId: string
    groupType: string
    dayOfWeek: string
    startTime: string
    endTime: string
}

interface ExistingContract {
    id: string
    effectiveDate?: Date
    supervisors: { supervisorId: string; isMainSupervisor: boolean }[]
    groupAssignments?: { supervisorId: string; officeGroupId: string }[]
}

interface ContractFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    studentPlanType: string        // REGULAR | CONCENTRATED
    individualOptions: IndividualOption[]
    groupOptions: GroupOption[]
    existing?: ExistingContract
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
    MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday"
}

const safe = (v: any) => (v === null || v === undefined) ? "" : String(v)

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractFormDialog({
    open, onOpenChange, studentId, studentPlanType,
    individualOptions, groupOptions, existing
}: ContractFormDialogProps) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [primaryId, setPrimaryId] = useState("")
    const [groupSelections, setGroupSelections] = useState<Array<{ supervisorId: string; officeGroupId: string }>>([])

    const isEditing = !!existing

    // Reset on open
    useEffect(() => {
        if (!open) return
        setError("")
        if (existing) {
            const main = existing.supervisors.find(s => s.isMainSupervisor)
            setPrimaryId(safe(main?.supervisorId || ""))
            setGroupSelections((existing.groupAssignments || []).map(ga => ({
                supervisorId: safe(ga.supervisorId),
                officeGroupId: safe(ga.officeGroupId)
            })))
        } else {
            setPrimaryId("")
            setGroupSelections([])
        }
    }, [open, existing])

    function toggleGroup(supervisorId: string, officeGroupId: string) {
        setGroupSelections(prev => {
            const exists = prev.find(g => g.supervisorId === supervisorId && g.officeGroupId === officeGroupId)
            return exists
                ? prev.filter(g => !(g.supervisorId === supervisorId && g.officeGroupId === officeGroupId))
                : [...prev, { supervisorId, officeGroupId }]
        })
    }

    function isGroupSelected(supervisorId: string, officeGroupId: string) {
        return groupSelections.some(g => g.supervisorId === supervisorId && g.officeGroupId === officeGroupId)
    }

    function handleSubmit() {
        setError("")
        if (!primaryId) { setError("Select an individual supervision supervisor."); return }

        startTransition(async () => {
            let result: any
            const payload = {
                studentId: safe(studentId),
                supervisorIds: [primaryId],
                mainSupervisorId: safe(primaryId),
                groupAssignments: groupSelections
            }
            if (isEditing) {
                result = await updateContract({ contractId: safe(existing!.id), ...payload })
            } else {
                result = await createContract(payload)
            }
            if (result?.error) { setError(safe(result.error)); return }
            toast.success(isEditing ? "Contract updated" : "Contract created & scheduled")
            onOpenChange(false)
            router.refresh()
        })
    }

    const scheduleLabel = studentPlanType === "CONCENTRATED"
        ? "Weekly — 4 sessions/month"
        : "Biweekly — 2 sessions/month"

    return (
        <Dialog open={open} onOpenChange={open => { if (!pending) onOpenChange(open) }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Supervision Team" : "Assign Supervision Team"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                            "text-[11px] font-bold",
                            studentPlanType === "CONCENTRATED"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            {studentPlanType}
                        </Badge>
                        <span>Plan · Groups shown are filtered by plan type</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2">

                    {/* ── Section 1: Individual Supervision ── */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1 border-b">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <h3 className="font-bold text-sm">Individual Supervision</h3>
                            <span className="text-xs text-muted-foreground">— Primary supervisor for 1-on-1 sessions</span>
                        </div>

                        {individualOptions.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed text-muted-foreground text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                No supervisors found for {studentPlanType} plan. Configure groups in Settings → Groups first.
                            </div>
                        ) : (
                            <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                                {individualOptions.map(sup => {
                                    const isFull = sup.currentStudents >= sup.maxStudents
                                    const isSelected = primaryId === sup.id
                                    return (
                                        <div
                                            key={sup.id}
                                            onClick={() => { if (!isFull) setPrimaryId(isSelected ? "" : sup.id) }}
                                            className={cn(
                                                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                                                isFull
                                                    ? "opacity-50 cursor-not-allowed bg-muted/20"
                                                    : isSelected
                                                        ? "border-primary bg-primary/5 cursor-pointer"
                                                        : "border-border hover:border-primary/40 hover:bg-muted/20 cursor-pointer"
                                            )}
                                        >
                                            {/* Radio dot */}
                                            <div className={cn(
                                                "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                                isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                                            )}>
                                                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold">{sup.fullName}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {sup.credentialType} · #{sup.bacbId || "N/A"}
                                                </p>
                                            </div>
                                            {/* Student count badge */}
                                            <div className={cn(
                                                "text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1",
                                                isFull
                                                    ? "bg-destructive/10 text-destructive"
                                                    : sup.currentStudents / sup.maxStudents >= 0.8
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-success/10 text-success"
                                            )}>
                                                <Users className="h-3 w-3" />
                                                {sup.currentStudents}/{sup.maxStudents}
                                                {isFull && " FULL"}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Section 2: Group Supervision ── */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 pb-1 border-b">
                            <Users className="h-4 w-4 text-blue-500" />
                            <h3 className="font-bold text-sm">Group Supervision</h3>
                            <span className="text-xs text-muted-foreground">— Select group sessions to enroll this student</span>
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                                <Clock className="h-2.5 w-2.5 mr-1" />
                                {scheduleLabel}
                            </Badge>
                        </div>

                        {groupOptions.length === 0 ? (
                            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed text-muted-foreground text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                No group sessions configured for {studentPlanType} plan. Add supervisors to groups in Settings → Groups.
                            </div>
                        ) : (
                            <div className="grid gap-2 max-h-52 overflow-y-auto pr-1">
                                {groupOptions.map((opt, idx) => {
                                    const selected = isGroupSelected(opt.supervisorId, opt.groupId)
                                    const key = `${opt.groupId}-${opt.supervisorId}`
                                    return (
                                        <div
                                            key={key}
                                            onClick={() => toggleGroup(opt.supervisorId, opt.groupId)}
                                            className={cn(
                                                "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors",
                                                selected
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/40 hover:bg-muted/20"
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <div className={cn(
                                                "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                                selected ? "bg-primary border-primary" : "border-muted-foreground"
                                            )}>
                                                {selected && <Check className="h-3 w-3 text-white" />}
                                            </div>
                                            {/* Supervisor info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold">{opt.supervisorName}</p>
                                                <p className="text-[10px] text-muted-foreground">{opt.credentialType}</p>
                                            </div>
                                            {/* Day + Time */}
                                            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="h-3 w-3" />
                                                    {DAY_LABELS[opt.dayOfWeek] || opt.dayOfWeek}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {opt.startTime}–{opt.endTime}
                                                </span>
                                                <Badge variant="outline" className={cn(
                                                    "text-[9px] font-bold",
                                                    opt.groupType === "CONCENTRATED"
                                                        ? "bg-orange-50 text-orange-700 border-orange-200"
                                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                                )}>
                                                    {opt.groupType}
                                                </Badge>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {groupSelections.length > 0 && (
                            <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">
                                ✓ {groupSelections.length} group session{groupSelections.length > 1 ? "s" : ""} selected.
                                Sessions will be auto-scheduled on the student's timesheet ({scheduleLabel}).
                            </p>
                        )}
                    </div>

                    {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Team" : "Confirm & Schedule"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
