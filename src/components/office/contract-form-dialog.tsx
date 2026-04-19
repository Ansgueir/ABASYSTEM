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

const MAX_GROUP: Record<string, number> = { REGULAR: 2, CONCENTRATED: 4 }
const BLOCKED_COUNT: Record<string, number[]> = { CONCENTRATED: [3] }

// ── Reusable star button ──────────────────────────────────────────────────────

function StarBtn({
    active, disabled, color, onClick, title, size = "h-4 w-4"
}: {
    active: boolean
    disabled?: boolean
    color: "yellow" | "sky" | "blue"
    onClick: () => void
    title?: string
    size?: string
}) {
    const colors = {
        yellow: { active: "text-yellow-500 bg-yellow-50", hover: "hover:text-yellow-400 hover:bg-yellow-50/60" },
        sky: { active: "text-sky-500 bg-sky-50", hover: "hover:text-sky-400 hover:bg-sky-50/60" },
        blue: { active: "text-blue-600 bg-blue-50", hover: "hover:text-blue-500 hover:bg-blue-50/60" },
    }
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={title}
            className={cn(
                "p-1 rounded-lg transition-all",
                active ? colors[color].active :
                    disabled ? "text-muted-foreground/15 cursor-not-allowed" :
                        `text-muted-foreground/30 ${colors[color].hover}`
            )}
        >
            <Star className={size} fill={active ? "currentColor" : "none"} />
        </button>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContractFormDialog({
    open, onOpenChange, studentId, studentPlanType,
    individualOptions, groupOptions, existing
}: ContractFormDialogProps) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")

    const [primaryId, setPrimaryId] = useState("")
    const [secondaryIds, setSecondaryIds] = useState<string[]>([])
    const [groupSelections, setGroupSelections] = useState<Array<{ supervisorId: string; officeGroupId: string }>>([])

    const isEditing = !!existing
    const maxGroups = MAX_GROUP[studentPlanType] ?? 2
    const blockedCounts = BLOCKED_COUNT[studentPlanType] ?? []

    // Deduped individual list (unique supervisors)
    const uniqueIndividuals = useMemo(() => {
        const seen = new Set<string>()
        return individualOptions.filter(opt => {
            if (seen.has(opt.id)) return false
            seen.add(opt.id)
            return true
        })
    }, [individualOptions])

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

    // ── Group logic ───────────────────────────────────────────────────────────

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
        if (nextCount > maxGroups) { toast.warning(`Max ${maxGroups} group sessions for ${studentPlanType} plan`); return }
        if (blockedCounts.includes(nextCount)) {
            toast.warning(`${studentPlanType} plan: select 1, 2 or 4 group sessions — not 3. Add a 4th or stay at 2.`); return
        }
        if (hasConflict(opt)) { toast.warning(`Conflict: another supervisor is already on ${DAY_LABELS[opt.dayOfWeek]} ${opt.startTime}`); return }
        setGroupSelections(prev => [...prev, { supervisorId: opt.supervisorId, officeGroupId: opt.groupId }])
    }

    // ── Individual logic ──────────────────────────────────────────────────────

    function toggleSecondary(id: string) {
        if (id === primaryId) { toast.warning("Already Primary — unset primary first"); return }
        setSecondaryIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    function setPrimary(id: string) {
        if (id === primaryId) { setPrimaryId(""); return }
        setSecondaryIds(prev => prev.filter(x => x !== id))
        setPrimaryId(id)
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    function handleSubmit() {
        setError("")
        if (!primaryId) { setError("Select a primary supervisor (★ gold)."); return }
        startTransition(async () => {
            const payload = {
                studentId: safe(studentId),
                supervisorIds: [primaryId, ...secondaryIds],
                mainSupervisorId: safe(primaryId),
                groupAssignments: groupSelections
            }
            const result: any = isEditing
                ? await updateContract({ contractId: safe(existing!.id), ...payload })
                : await createContract(payload)
            if (result?.error) { setError(safe(result.error)); return }
            toast.success(isEditing ? "Contract updated" : `Contract created — ${groupSelections.length} group session(s) scheduled`)
            onOpenChange(false)
            router.refresh()
        })
    }

    const groupCount = groupSelections.length

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v) }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        {isEditing ? "Edit Supervision Team" : "Assign Supervision Team"}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-2 flex-wrap text-xs">
                        <Badge variant="outline" className={cn(
                            "text-[11px] font-bold",
                            studentPlanType === "CONCENTRATED"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>{studentPlanType}</Badge>
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" /> Primary
                            <span className="mx-1">·</span>
                            <Star className="h-3 w-3 text-sky-500 fill-sky-500" /> Secondary ind.
                            <span className="mx-1">·</span>
                            <Star className="h-3 w-3 text-blue-600 fill-blue-600" /> Group (max {maxGroups})
                        </span>
                    </DialogDescription>
                </DialogHeader>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SECTION 1 — INDIVIDUAL SUPERVISION (unique supervisors)    */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 px-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Individual Supervision</span>
                        <span className="text-[10px] text-muted-foreground ml-1">— select primary &amp; secondary supervisors</span>
                    </div>

                    <div className="rounded-xl border overflow-hidden">
                        {/* Header */}
                        <div className="grid grid-cols-[1fr_68px_52px_52px] bg-muted/40 border-b px-4 py-2 gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supervisor</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Count</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 text-center">
                                <Star className="h-3 w-3 inline fill-yellow-500 text-yellow-500" /> Prim
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-500 text-center">
                                <Star className="h-3 w-3 inline fill-sky-400 text-sky-400" /> Sec
                            </span>
                        </div>

                        {uniqueIndividuals.length === 0 ? (
                            <div className="flex items-center gap-2 p-4 text-muted-foreground text-sm">
                                <AlertTriangle className="h-4 w-4" />
                                No supervisors found. Configure groups in Settings → Groups first.
                            </div>
                        ) : (
                            <div className="divide-y">
                                {uniqueIndividuals.map(sup => {
                                    const isFull = sup.currentStudents >= sup.maxStudents
                                    const isPrimary = primaryId === sup.id
                                    const isSecondary = secondaryIds.includes(sup.id)
                                    return (
                                        <div key={sup.id} className={cn(
                                            "grid grid-cols-[1fr_68px_52px_52px] px-4 py-2.5 items-center gap-2 transition-colors",
                                            (isPrimary || isSecondary) ? "bg-primary/5" : "hover:bg-muted/10"
                                        )}>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{sup.fullName}</p>
                                                <p className="text-[10px] text-muted-foreground">{sup.credentialType} · #{sup.bacbId || "N/A"}</p>
                                            </div>
                                            <div className="text-center">
                                                <span className={cn(
                                                    "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                    isFull ? "bg-destructive/10 text-destructive"
                                                        : sup.currentStudents / sup.maxStudents >= 0.8
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-success/10 text-success"
                                                )}>
                                                    {sup.currentStudents}/{sup.maxStudents}
                                                </span>
                                            </div>
                                            {/* ★ Primary */}
                                            <div className="flex justify-center">
                                                <StarBtn
                                                    active={isPrimary}
                                                    disabled={!isPrimary && isFull}
                                                    color="yellow"
                                                    onClick={() => setPrimary(sup.id)}
                                                    title={isFull && !isPrimary ? "At max capacity" : isPrimary ? "Remove primary" : "Set as primary"}
                                                />
                                            </div>
                                            {/* ★ Secondary */}
                                            <div className="flex justify-center">
                                                <StarBtn
                                                    active={isSecondary}
                                                    disabled={isPrimary}
                                                    color="sky"
                                                    onClick={() => toggleSecondary(sup.id)}
                                                    title={isPrimary ? "Already Primary" : isSecondary ? "Remove secondary" : "Add as secondary"}
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* SECTION 2 — GROUP SESSIONS (supervisor × group combos)     */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 px-1">
                        <Star className="h-3.5 w-3.5 text-blue-600 fill-blue-600" />
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Group Sessions</span>
                        <span className="text-[10px] text-muted-foreground ml-1">— select group slot(s) to enroll this student</span>
                        {/* quota pills */}
                        <div className="flex gap-1 ml-auto items-center">
                            {Array.from({ length: maxGroups }).map((_, i) => {
                                const blocked = blockedCounts.includes(i + 1)
                                return (
                                    <div key={i} className={cn(
                                        "h-2 w-6 rounded-full",
                                        blocked ? "bg-amber-200" :
                                            i < groupCount ? "bg-blue-600" : "bg-muted"
                                    )} />
                                )
                            })}
                            <span className={cn(
                                "text-[10px] font-bold ml-1",
                                groupCount >= maxGroups ? "text-blue-600" : "text-muted-foreground"
                            )}>{groupCount}/{maxGroups}</span>
                        </div>
                    </div>

                    {groupOptions.length === 0 ? (
                        <div className="flex items-center gap-2 p-4 rounded-xl border border-dashed text-muted-foreground text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            No group slots found for {studentPlanType} plan. Assign supervisors to groups in Settings → Groups.
                        </div>
                    ) : (
                        <div className="rounded-xl border overflow-hidden">
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_68px_44px_96px_90px] bg-muted/40 border-b px-4 py-2 gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supervisor</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Count</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 text-center">
                                    <Star className="h-3 w-3 inline fill-blue-600 text-blue-600" /> Grp
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Day</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Time</span>
                            </div>

                            <div className="divide-y">
                                {groupOptions.map(opt => {
                                    const key = `${opt.groupId}-${opt.supervisorId}`
                                    const indInfo = individualOptions.find(i => i.id === opt.supervisorId)
                                    const isGrpSel = isGroupSelected(opt.supervisorId, opt.groupId)
                                    const conflict = !isGrpSel && hasConflict(opt)
                                    const grpAtLimit = !isGrpSel && groupCount >= maxGroups
                                    const wouldBeBlocked = !isGrpSel && blockedCounts.includes(groupCount + 1)
                                    const grpDisabled = conflict || grpAtLimit || wouldBeBlocked

                                    return (
                                        <div key={key} className={cn(
                                            "grid grid-cols-[1fr_68px_44px_96px_90px] px-4 py-2.5 items-center gap-2 transition-colors",
                                            isGrpSel ? "bg-blue-50/60" : conflict ? "opacity-40" : "hover:bg-muted/10"
                                        )}>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{opt.supervisorName}</p>
                                                <p className="text-[10px] text-muted-foreground">{opt.credentialType}</p>
                                            </div>
                                            <div className="text-center">
                                                {indInfo ? (
                                                    <span className={cn(
                                                        "text-xs font-bold px-1.5 py-0.5 rounded-md",
                                                        indInfo.currentStudents >= indInfo.maxStudents
                                                            ? "bg-destructive/10 text-destructive"
                                                            : indInfo.currentStudents / indInfo.maxStudents >= 0.8
                                                                ? "bg-amber-100 text-amber-700"
                                                                : "bg-success/10 text-success"
                                                    )}>
                                                        {indInfo.currentStudents}/{indInfo.maxStudents}
                                                    </span>
                                                ) : <span className="text-xs text-muted-foreground">—</span>}
                                            </div>
                                            {/* ★ Group */}
                                            <div className="flex justify-center">
                                                <StarBtn
                                                    active={isGrpSel}
                                                    disabled={grpDisabled}
                                                    color="blue"
                                                    onClick={() => toggleGroup(opt)}
                                                    title={
                                                        conflict ? `Conflict: same day/time already assigned`
                                                            : wouldBeBlocked ? `${studentPlanType}: use 1, 2 or 4 groups — not 3`
                                                                : grpAtLimit ? `Max ${maxGroups} reached`
                                                                    : isGrpSel ? "Remove from group" : "Enroll in this group"
                                                    }
                                                />
                                            </div>
                                            {/* Day */}
                                            <div className="flex justify-center items-center gap-1">
                                                {conflict && <Ban className="h-2.5 w-2.5 text-destructive/50 shrink-0" />}
                                                <span className="text-xs font-medium text-slate-700">
                                                    {DAY_LABELS[opt.dayOfWeek] || opt.dayOfWeek}
                                                </span>
                                            </div>
                                            {/* Time */}
                                            <div className="text-center">
                                                <span className="text-xs text-muted-foreground">{opt.startTime}–{opt.endTime}</span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Summary ── */}
                {(primaryId || secondaryIds.length > 0 || groupCount > 0) && (
                    <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1">
                        {primaryId && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                                <strong>Primary:</strong> {uniqueIndividuals.find(i => i.id === primaryId)?.fullName || primaryId}
                            </p>
                        )}
                        {secondaryIds.length > 0 && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-sky-500 fill-sky-500 shrink-0" />
                                <strong>Secondary:</strong> {secondaryIds.map(id => uniqueIndividuals.find(i => i.id === id)?.fullName || id).join(", ")}
                            </p>
                        )}
                        {groupCount > 0 && (
                            <p className="flex items-center gap-1.5">
                                <Star className="h-3 w-3 text-blue-600 fill-blue-600 shrink-0" />
                                <strong>Groups ({groupCount}/{maxGroups}):</strong>{" "}
                                {groupSelections.map(sel => {
                                    const opt = groupOptions.find(g => g.supervisorId === sel.supervisorId && g.groupId === sel.officeGroupId)
                                    return opt ? `${opt.supervisorName} · ${DAY_LABELS[opt.dayOfWeek]}` : ""
                                }).filter(Boolean).join(" — ")}
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
