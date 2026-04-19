"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Loader2, Star, Users, Calendar, Clock, AlertTriangle, Ban } from "lucide-react"
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
    studentPlanType: string
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

    // Max group selections by plan type
    const maxGroups = studentPlanType === "CONCENTRATED" ? 4 : 2

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

    // Lookup map for individual options
    const indMap = useMemo(() => {
        const m: Record<string, IndividualOption> = {}
        for (const opt of individualOptions) m[opt.id] = opt
        return m
    }, [individualOptions])

    // Check if a group option conflicts with current selections (same day+time, different supervisor)
    function hasConflict(opt: GroupOption): boolean {
        for (const sel of groupSelections) {
            if (sel.supervisorId === opt.supervisorId && sel.officeGroupId === opt.groupId) continue // same row, skip
            const selOpt = groupOptions.find(g => g.supervisorId === sel.supervisorId && g.groupId === sel.officeGroupId)
            if (selOpt && selOpt.dayOfWeek === opt.dayOfWeek && selOpt.startTime === opt.startTime) {
                return true // same day + same time = physical conflict
            }
        }
        return false
    }

    function isGroupSelected(supervisorId: string, officeGroupId: string) {
        return groupSelections.some(g => g.supervisorId === supervisorId && g.officeGroupId === officeGroupId)
    }

    function toggleGroup(opt: GroupOption) {
        const selected = isGroupSelected(opt.supervisorId, opt.groupId)
        if (selected) {
            setGroupSelections(prev => prev.filter(g => !(g.supervisorId === opt.supervisorId && g.officeGroupId === opt.groupId)))
        } else {
            if (groupSelections.length >= maxGroups) {
                toast.warning(`Maximum ${maxGroups} group sessions for ${studentPlanType} plan`)
                return
            }
            if (hasConflict(opt)) {
                toast.warning("Conflict: another supervisor is already assigned to this day and time slot")
                return
            }
            setGroupSelections(prev => [...prev, { supervisorId: opt.supervisorId, officeGroupId: opt.groupId }])
        }
    }

    function handleSubmit() {
        setError("")
        if (!primaryId) { setError("Select an individual supervision supervisor (★ Ind)."); return }

        startTransition(async () => {
            const payload = {
                studentId: safe(studentId),
                supervisorIds: [primaryId],
                mainSupervisorId: safe(primaryId),
                groupAssignments: groupSelections
            }
            let result: any
            if (isEditing) {
                result = await updateContract({ contractId: safe(existing!.id), ...payload })
            } else {
                result = await createContract(payload)
            }
            if (result?.error) { setError(safe(result.error)); return }
            toast.success(isEditing ? "Contract updated" : `Contract created — ${groupSelections.length} group session(s) scheduled`)
            onOpenChange(false)
            router.refresh()
        })
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const groupCount = groupSelections.length

    return (
        <Dialog open={open} onOpenChange={open => { if (!pending) onOpenChange(open) }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Supervision Team" : "Assign Supervision Team"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className={cn(
                            "text-[11px] font-bold",
                            studentPlanType === "CONCENTRATED"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            {studentPlanType} Plan
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            — ★ <strong>Ind</strong>: individual supervisor (1 required) &nbsp;·&nbsp;
                            ★ <strong>Group</strong>: group sessions (max <strong>{maxGroups}</strong> for {studentPlanType} plan)
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {/* ── Quota bar ── */}
                <div className="flex items-center gap-3 rounded-xl border px-4 py-2.5 bg-muted/20">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Group sessions</span>
                    <div className="flex gap-1.5">
                        {Array.from({ length: maxGroups }).map((_, i) => (
                            <div key={i} className={cn(
                                "h-2.5 w-8 rounded-full transition-colors",
                                i < groupCount
                                    ? groupCount >= maxGroups ? "bg-primary" : "bg-primary/70"
                                    : "bg-muted"
                            )} />
                        ))}
                    </div>
                    <span className={cn(
                        "text-xs font-bold ml-auto",
                        groupCount >= maxGroups ? "text-primary" : "text-muted-foreground"
                    )}>
                        {groupCount} / {maxGroups} selected
                    </span>
                </div>

                {/* ── Table ── */}
                {groupOptions.length === 0 ? (
                    <div className="flex items-center gap-2 p-4 rounded-lg border border-dashed text-muted-foreground text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        No supervisors found for {studentPlanType} plan. Assign supervisors to groups in Settings → Groups first.
                    </div>
                ) : (
                    <div className="rounded-xl border overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_72px_56px_56px_100px_96px] gap-0 bg-muted/40 border-b px-4 py-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Supervisor</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Count</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-primary text-center">Ind</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 text-center">Group</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Day</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Time</span>
                        </div>

                        {/* Rows */}
                        <div className="divide-y">
                            {groupOptions.map((opt) => {
                                const key = `${opt.groupId}-${opt.supervisorId}`
                                const indInfo = indMap[opt.supervisorId]
                                const isFull = indInfo ? indInfo.currentStudents >= indInfo.maxStudents : false
                                const isIndSelected = primaryId === opt.supervisorId
                                const isGrpSelected = isGroupSelected(opt.supervisorId, opt.groupId)
                                const conflict = !isGrpSelected && hasConflict(opt)
                                const atLimit = !isGrpSelected && groupCount >= maxGroups

                                const grpDisabled = conflict || (atLimit && !isGrpSelected)

                                return (
                                    <div
                                        key={key}
                                        className={cn(
                                            "grid grid-cols-[1fr_72px_56px_56px_100px_96px] gap-0 px-4 py-3 items-center transition-colors",
                                            (isIndSelected || isGrpSelected) ? "bg-primary/5" : "hover:bg-muted/20"
                                        )}
                                    >
                                        {/* Supervisor name */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate">{opt.supervisorName}</p>
                                            <p className="text-[10px] text-muted-foreground">{opt.credentialType}</p>
                                        </div>

                                        {/* Student count */}
                                        <div className="text-center">
                                            {indInfo ? (
                                                <span className={cn(
                                                    "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                    isFull
                                                        ? "bg-destructive/10 text-destructive"
                                                        : indInfo.currentStudents / indInfo.maxStudents >= 0.8
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-success/10 text-success"
                                                )}>
                                                    {indInfo.currentStudents}/{indInfo.maxStudents}
                                                </span>
                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                        </div>

                                        {/* Ind (radio) */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                disabled={!isIndSelected && isFull}
                                                onClick={() => setPrimaryId(isIndSelected ? "" : opt.supervisorId)}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    isIndSelected
                                                        ? "text-yellow-500"
                                                        : isFull
                                                            ? "text-muted-foreground/30 cursor-not-allowed"
                                                            : "text-muted-foreground/40 hover:text-yellow-400"
                                                )}
                                                title={isFull ? "Supervisor at max capacity" : isIndSelected ? "Remove individual assignment" : "Set as individual supervisor"}
                                            >
                                                <Star className="h-5 w-5" fill={isIndSelected ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        {/* Group (checkbox-star) */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                disabled={grpDisabled}
                                                onClick={() => toggleGroup(opt)}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    isGrpSelected
                                                        ? "text-blue-500"
                                                        : conflict
                                                            ? "text-muted-foreground/20 cursor-not-allowed"
                                                            : atLimit
                                                                ? "text-muted-foreground/20 cursor-not-allowed"
                                                                : "text-muted-foreground/40 hover:text-blue-400"
                                                )}
                                                title={
                                                    conflict ? `Conflict: another supervisor already on ${DAY_LABELS[opt.dayOfWeek]} ${opt.startTime}`
                                                        : atLimit ? `Max ${maxGroups} group sessions reached for ${studentPlanType} plan`
                                                            : isGrpSelected ? "Remove from group"
                                                                : "Add to group"
                                                }
                                            >
                                                <Star className="h-5 w-5" fill={isGrpSelected ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        {/* Day */}
                                        <div className="flex justify-center items-center gap-1">
                                            {conflict && !isGrpSelected && (
                                                <Ban className="h-3 w-3 text-destructive/50" />
                                            )}
                                            <span className={cn(
                                                "text-xs font-semibold",
                                                conflict && !isGrpSelected ? "text-muted-foreground/40" : "text-slate-700"
                                            )}>
                                                {DAY_LABELS[opt.dayOfWeek] || opt.dayOfWeek}
                                            </span>
                                        </div>

                                        {/* Time */}
                                        <div className="text-center">
                                            <span className={cn(
                                                "text-xs",
                                                conflict && !isGrpSelected ? "text-muted-foreground/40" : "text-muted-foreground"
                                            )}>
                                                {opt.startTime}–{opt.endTime}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Summary */}
                {(primaryId || groupCount > 0) && (
                    <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1">
                        {primaryId && (
                            <p>
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 inline mr-1" />
                                <strong>Individual:</strong> {individualOptions.find(i => i.id === primaryId)?.fullName || primaryId}
                            </p>
                        )}
                        {groupCount > 0 && (
                            <p>
                                <Star className="h-3 w-3 text-blue-500 fill-blue-500 inline mr-1" />
                                <strong>Groups ({groupCount}/{maxGroups}):</strong>{" "}
                                {groupSelections.map(sel => {
                                    const opt = groupOptions.find(g => g.supervisorId === sel.supervisorId && g.groupId === sel.officeGroupId)
                                    return opt ? `${opt.supervisorName} (${DAY_LABELS[opt.dayOfWeek]})` : sel.supervisorId
                                }).join(" · ")}
                            </p>
                        )}
                    </div>
                )}

                {error && <p className="text-sm font-medium text-destructive">{error}</p>}

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
