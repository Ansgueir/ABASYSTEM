"use client"

import { useState, useTransition, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import { Loader2, Star, Users, Ban, AlertTriangle } from "lucide-react"
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

// ── Business rules matrix ─────────────────────────────────────────────────────
// REGULAR:  1 day → 14d interval | 2 days → 28d each, offset 14d (biweekly, alternating)
// CONC:     1 day → 7d | 2 days → 14d each, offset 7d | 3 BLOCKED | 4 days → 28d each, offset 7d
const MAX_GROUP: Record<string, number> = { REGULAR: 2, CONCENTRATED: 4 }
const BLOCKED_COUNT: Record<string, number[]> = { CONCENTRATED: [3] }

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractFormDialog({
    open, onOpenChange, studentId, studentPlanType,
    individualOptions, groupOptions, existing
}: ContractFormDialogProps) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")

    // ★ Gold: primary individual (radio, 1)
    const [primaryId, setPrimaryId] = useState("")
    // ★ Blue (Ind): secondary individual (checkbox, N)
    const [secondaryIds, setSecondaryIds] = useState<string[]>([])
    // ★ Blue (Group): group sessions (checkbox, limited)
    const [groupSelections, setGroupSelections] = useState<Array<{ supervisorId: string; officeGroupId: string }>>([])

    const isEditing = !!existing
    const maxGroups = MAX_GROUP[studentPlanType] ?? 2
    const blockedCounts = BLOCKED_COUNT[studentPlanType] ?? []

    // Reset on open
    useEffect(() => {
        if (!open) return
        setError("")
        if (existing) {
            const main = existing.supervisors.find(s => s.isMainSupervisor)
            const secondaries = existing.supervisors.filter(s => !s.isMainSupervisor).map(s => safe(s.supervisorId))
            setPrimaryId(safe(main?.supervisorId || ""))
            setSecondaryIds(secondaries)
            setGroupSelections((existing.groupAssignments || []).map(ga => ({
                supervisorId: safe(ga.supervisorId),
                officeGroupId: safe(ga.officeGroupId)
            })))
        } else {
            setPrimaryId(""); setSecondaryIds([]); setGroupSelections([])
        }
    }, [open, existing])

    // Lookup map
    const indMap = useMemo(() => {
        const m: Record<string, IndividualOption> = {}
        for (const opt of individualOptions) m[opt.id] = opt
        return m
    }, [individualOptions])

    // ── Group selection logic ──────────────────────────────────────────────────

    function isGroupSelected(supervisorId: string, officeGroupId: string) {
        return groupSelections.some(g => g.supervisorId === supervisorId && g.officeGroupId === officeGroupId)
    }

    function hasConflict(opt: GroupOption): boolean {
        for (const sel of groupSelections) {
            if (sel.supervisorId === opt.supervisorId && sel.officeGroupId === opt.groupId) continue
            const selOpt = groupOptions.find(g => g.supervisorId === sel.supervisorId && g.groupId === sel.officeGroupId)
            if (selOpt && selOpt.dayOfWeek === opt.dayOfWeek && selOpt.startTime === opt.startTime) return true
        }
        return false
    }

    function toggleGroup(opt: GroupOption) {
        const selected = isGroupSelected(opt.supervisorId, opt.groupId)
        if (selected) {
            setGroupSelections(prev => prev.filter(g => !(g.supervisorId === opt.supervisorId && g.officeGroupId === opt.groupId)))
            return
        }
        const nextCount = groupSelections.length + 1
        if (nextCount > maxGroups) {
            toast.warning(`Maximum ${maxGroups} group sessions for ${studentPlanType} plan`)
            return
        }
        if (blockedCounts.includes(nextCount)) {
            toast.warning(
                `${studentPlanType} plan does not support ${nextCount} group sessions — valid counts are 1, 2 or 4. ` +
                `Add a 4th group or remove one to stay at 2.`
            )
            return
        }
        if (hasConflict(opt)) {
            toast.warning(`Conflict: another supervisor is already scheduled on ${DAY_LABELS[opt.dayOfWeek]} ${opt.startTime}`)
            return
        }
        setGroupSelections(prev => [...prev, { supervisorId: opt.supervisorId, officeGroupId: opt.groupId }])
    }

    // ── Individual (secondary) logic ──────────────────────────────────────────

    function toggleSecondary(id: string) {
        if (id === primaryId) { toast.warning("This supervisor is already the primary. Unset primary first."); return }
        setSecondaryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    function setPrimary(id: string) {
        if (id === primaryId) { setPrimaryId(""); return }
        // If was secondary, remove from secondary list
        setSecondaryIds(prev => prev.filter(x => x !== id))
        setPrimaryId(id)
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    function handleSubmit() {
        setError("")
        if (!primaryId) { setError("Select a primary supervisor (★ gold)."); return }
        const allSupIds = [primaryId, ...secondaryIds]
        const payload = {
            studentId: safe(studentId),
            supervisorIds: allSupIds,
            mainSupervisorId: safe(primaryId),
            groupAssignments: groupSelections
        }
        startTransition(async () => {
            let result: any
            if (isEditing) result = await updateContract({ contractId: safe(existing!.id), ...payload })
            else result = await createContract(payload)
            if (result?.error) { setError(safe(result.error)); return }
            const sessionsMsg = groupSelections.length > 0
                ? ` — ${groupSelections.length} group session(s) scheduled`
                : ""
            toast.success(isEditing ? "Contract updated" : `Contract created${sessionsMsg}`)
            onOpenChange(false)
            router.refresh()
        })
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const groupCount = groupSelections.length

    return (
        <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v) }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Supervision Team" : "Assign Supervision Team"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-3 flex-wrap text-xs">
                        <Badge variant="outline" className={cn(
                            "text-[11px] font-bold",
                            studentPlanType === "CONCENTRATED"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>{studentPlanType}</Badge>
                        <span className="flex items-center gap-2 flex-wrap">
                            <span><Star className="h-3 w-3 text-yellow-500 fill-yellow-500 inline mr-0.5" /><strong>Primary</strong> individual (1 required)</span>
                            <span className="text-muted-foreground">·</span>
                            <span><Star className="h-3 w-3 text-sky-400 fill-sky-400 inline mr-0.5" /><strong>Secondary</strong> individual (optional)</span>
                            <span className="text-muted-foreground">·</span>
                            <span><Star className="h-3 w-3 text-blue-600 fill-blue-600 inline mr-0.5" /><strong>Group</strong> session (max {maxGroups})</span>
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {/* ── Group quota bar ── */}
                {maxGroups > 0 && (
                    <div className="flex items-center gap-3 rounded-xl border px-4 py-2 bg-muted/20">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Group sessions</span>
                        <div className="flex gap-1.5">
                            {Array.from({ length: maxGroups }).map((_, i) => {
                                const blocked = blockedCounts.includes(i + 1)
                                return (
                                    <div key={i} className={cn(
                                        "h-2 w-8 rounded-full transition-colors relative",
                                        blocked ? "bg-amber-200" :
                                            i < groupCount ? "bg-blue-600" : "bg-muted"
                                    )}>
                                        {blocked && <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-amber-700">✕</span>}
                                    </div>
                                )
                            })}
                        </div>
                        <span className={cn(
                            "text-xs font-bold ml-auto",
                            blockedCounts.includes(groupCount) ? "text-amber-600" :
                                groupCount >= maxGroups ? "text-blue-600" : "text-muted-foreground"
                        )}>
                            {groupCount} / {maxGroups}
                            {blockedCounts.includes(groupCount) && " ⚠ invalid count"}
                        </span>
                    </div>
                )}

                {/* ── Table ── */}
                {groupOptions.length === 0 ? (
                    <div className="flex items-center gap-2 p-4 rounded-lg border border-dashed text-muted-foreground text-sm">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        No supervisors found for {studentPlanType} plan. Assign supervisors to groups in Settings → Groups first.
                    </div>
                ) : (
                    <div className="rounded-xl border overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_64px_42px_42px_42px_90px_88px] bg-muted/40 border-b px-3 py-2 gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supervisor</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Count</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 text-center" title="Primary individual supervisor">Prim</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 text-center" title="Secondary individual supervisor">Sec</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 text-center" title="Group session">Grp</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Day</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Time</span>
                        </div>

                        {/* Rows */}
                        <div className="divide-y">
                            {groupOptions.map((opt) => {
                                const key = `${opt.groupId}-${opt.supervisorId}`
                                const indInfo = indMap[opt.supervisorId]
                                const isFull = indInfo ? indInfo.currentStudents >= indInfo.maxStudents : false
                                const isPrimary = primaryId === opt.supervisorId
                                const isSecondary = secondaryIds.includes(opt.supervisorId)
                                const isGrpSel = isGroupSelected(opt.supervisorId, opt.groupId)
                                const conflict = !isGrpSel && hasConflict(opt)
                                const grpAtLimit = !isGrpSel && groupCount >= maxGroups
                                const wouldBeBlocked = !isGrpSel && blockedCounts.includes(groupCount + 1)
                                const grpDisabled = conflict || grpAtLimit || wouldBeBlocked

                                const rowHighlight = isPrimary || isSecondary || isGrpSel

                                return (
                                    <div
                                        key={key}
                                        className={cn(
                                            "grid grid-cols-[1fr_64px_42px_42px_42px_90px_88px] px-3 py-2.5 items-center gap-1 transition-colors",
                                            rowHighlight ? "bg-primary/5" : "hover:bg-muted/10"
                                        )}
                                    >
                                        {/* Supervisor */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold truncate leading-tight">{opt.supervisorName}</p>
                                            <p className="text-[10px] text-muted-foreground">{opt.credentialType}</p>
                                        </div>

                                        {/* Count */}
                                        <div className="text-center">
                                            {indInfo ? (
                                                <span className={cn(
                                                    "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                    isFull ? "bg-destructive/10 text-destructive"
                                                        : indInfo.currentStudents / indInfo.maxStudents >= 0.8
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-success/10 text-success"
                                                )}>
                                                    {indInfo.currentStudents}/{indInfo.maxStudents}
                                                </span>
                                            ) : <span className="text-xs text-muted-foreground">—</span>}
                                        </div>

                                        {/* ★ Primary (gold) */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                disabled={!isPrimary && isFull}
                                                onClick={() => setPrimary(opt.supervisorId)}
                                                title={isFull && !isPrimary ? "At max capacity" : isPrimary ? "Remove as primary" : "Set as primary supervisor"}
                                                className={cn(
                                                    "p-1 rounded-lg transition-all",
                                                    isPrimary ? "text-yellow-500 bg-yellow-50" :
                                                        isFull ? "text-muted-foreground/20 cursor-not-allowed" :
                                                            "text-muted-foreground/30 hover:text-yellow-400 hover:bg-yellow-50/50"
                                                )}
                                            >
                                                <Star className="h-4 w-4" fill={isPrimary ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        {/* ★ Secondary (sky blue) */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                disabled={isPrimary}
                                                onClick={() => toggleSecondary(opt.supervisorId)}
                                                title={isPrimary ? "Already primary — can't be secondary" : isSecondary ? "Remove as secondary" : "Add as secondary individual supervisor"}
                                                className={cn(
                                                    "p-1 rounded-lg transition-all",
                                                    isSecondary ? "text-sky-500 bg-sky-50" :
                                                        isPrimary ? "text-muted-foreground/10 cursor-not-allowed" :
                                                            "text-muted-foreground/30 hover:text-sky-400 hover:bg-sky-50/50"
                                                )}
                                            >
                                                <Star className="h-4 w-4" fill={isSecondary ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        {/* ★ Group (blue) */}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                disabled={grpDisabled}
                                                onClick={() => toggleGroup(opt)}
                                                title={
                                                    conflict ? `Conflict: same day/time slot already taken`
                                                        : wouldBeBlocked ? `${studentPlanType} doesn't support ${groupCount + 1} groups (use 1, 2 or 4)`
                                                            : grpAtLimit ? `Max ${maxGroups} groups reached`
                                                                : isGrpSel ? "Remove from group"
                                                                    : "Add to group session"
                                                }
                                                className={cn(
                                                    "p-1 rounded-lg transition-all",
                                                    isGrpSel ? "text-blue-600 bg-blue-50" :
                                                        grpDisabled ? "text-muted-foreground/15 cursor-not-allowed" :
                                                            "text-muted-foreground/30 hover:text-blue-500 hover:bg-blue-50/50"
                                                )}
                                            >
                                                <Star className="h-4 w-4" fill={isGrpSel ? "currentColor" : "none"} />
                                            </button>
                                        </div>

                                        {/* Day */}
                                        <div className="flex justify-center items-center gap-1">
                                            {conflict && !isGrpSel && <Ban className="h-2.5 w-2.5 text-destructive/40" />}
                                            <span className={cn("text-xs font-medium", conflict && !isGrpSel ? "text-muted-foreground/30" : "text-slate-700")}>
                                                {DAY_LABELS[opt.dayOfWeek] || opt.dayOfWeek}
                                            </span>
                                        </div>

                                        {/* Time */}
                                        <div className="text-center">
                                            <span className={cn("text-xs", conflict && !isGrpSel ? "text-muted-foreground/30" : "text-muted-foreground")}>
                                                {opt.startTime}–{opt.endTime}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ── Selection summary ── */}
                {(primaryId || secondaryIds.length > 0 || groupCount > 0) && (
                    <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1.5">
                        {primaryId && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                                <strong>Primary:</strong> {individualOptions.find(i => i.id === primaryId)?.fullName || primaryId}
                            </p>
                        )}
                        {secondaryIds.length > 0 && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-sky-500 fill-sky-500 shrink-0" />
                                <strong>Secondary:</strong> {secondaryIds.map(id => individualOptions.find(i => i.id === id)?.fullName || id).join(", ")}
                            </p>
                        )}
                        {groupCount > 0 && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-blue-600 fill-blue-600 shrink-0" />
                                <strong>Groups ({groupCount}/{maxGroups}):</strong>{" "}
                                {groupSelections.map(sel => {
                                    const opt = groupOptions.find(g => g.supervisorId === sel.supervisorId && g.groupId === sel.officeGroupId)
                                    return opt ? `${opt.supervisorName} (${DAY_LABELS[opt.dayOfWeek]})` : ""
                                }).filter(Boolean).join(" · ")}
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
