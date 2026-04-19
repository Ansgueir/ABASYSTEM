"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Download, Trash2, Users, Calendar, Loader2, Star, Plus,
    Pencil, RotateCcw, XCircle, Clock
} from "lucide-react"
import { format } from "date-fns"
import { deleteContract, resendContract } from "@/actions/contracts"
import { ContractFormDialog } from "@/components/office/contract-form-dialog"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContractEntry {
    id: string
    effectiveDate: Date
    status: string
    createdAt: Date
    supervisors: {
        supervisorId: string
        isMainSupervisor: boolean
        supervisor: { fullName: string; bacbId: string; credentialType: string }
    }[]
    groupAssignments?: {
        supervisorId: string
        officeGroupId: string
        supervisor: { fullName: string; credentialType: string }
        officeGroup: { name: string; groupType: string; dayOfWeek: string; startTime: string; endTime: string }
    }[]
    rejectionReason?: string | null
}

interface OfficeGroupData {
    id: string
    name: string
    groupType: string
    dayOfWeek: string
    startTime: string
    endTime: string
    supervisors: {
        supervisorId: string
        supervisor: {
            id: string
            fullName: string
            bacbId: string
            credentialType: string
            maxStudents: number | null
            status: string
        }
    }[]
}

interface OfficeContractsTabProps {
    studentId: string
    contracts: ContractEntry[]
    allSupervisors: { id: string; fullName: string; bacbId: string; credentialType: string }[]
    officeGroups: OfficeGroupData[]
    supervisorCountMap: Record<string, number>
    studentPlanType: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "secondary", ACTIVE: "success", SENT: "default", SIGNED: "outline", REJECTED: "destructive"
}

const DAY_LABELS: Record<string, string> = {
    MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
    THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun"
}

const safe = (v: any) => {
    if (v === null || v === undefined) return ""
    if (typeof v === "object") {
        try {
            if (v.month !== undefined && v.year !== undefined) return `${v.month}/${v.year}`
            if (v.id) return String(v.id)
            return JSON.stringify(v)
        } catch { return "[Object]" }
    }
    return String(v)
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OfficeContractsTab({
    studentId, contracts, allSupervisors,
    officeGroups, supervisorCountMap, studentPlanType
}: OfficeContractsTabProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [selectedContract, setSelectedContract] = useState<ContractEntry | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    // Build individual + group options from office groups
    const individualOptions = (() => {
        const seen = new Set<string>()
        const opts: any[] = []
        for (const g of officeGroups) {
            for (const s of g.supervisors) {
                if (seen.has(s.supervisorId)) continue
                seen.add(s.supervisorId)
                opts.push({
                    id: s.supervisorId,
                    fullName: s.supervisor.fullName,
                    bacbId: s.supervisor.bacbId,
                    credentialType: s.supervisor.credentialType,
                    currentStudents: supervisorCountMap[s.supervisorId] ?? 0,
                    maxStudents: s.supervisor.maxStudents ?? 10
                })
            }
        }
        return opts
    })()

    const groupOptions = officeGroups.flatMap(g =>
        g.supervisors.map(s => ({
            supervisorId: s.supervisorId,
            supervisorName: s.supervisor.fullName,
            credentialType: s.supervisor.credentialType,
            groupId: g.id,
            groupType: g.groupType,
            dayOfWeek: g.dayOfWeek,
            startTime: g.startTime,
            endTime: g.endTime
        }))
    )

    const handleCreateNew = () => { setSelectedContract(null); setIsDialogOpen(true) }
    const handleEdit = (c: ContractEntry) => { setSelectedContract(c); setIsDialogOpen(true) }
    const handleDeleteClick = (id: string) => { setDeletingId(safe(id)); setShowDeleteConfirm(true) }

    const handleConfirmDelete = () => {
        if (!deletingId) return
        startTransition(async () => {
            const res = await deleteContract(deletingId)
            if (res.error) toast.error(res.error)
            else toast.success("Contract deleted")
            setShowDeleteConfirm(false)
            setDeletingId(null)
            router.refresh()
        })
    }

    const handleResend = (id: string) => {
        startTransition(async () => {
            const res = await resendContract(id)
            if (res.error) toast.error(res.error)
            else { toast.success("Contract re-sent to student"); router.refresh() }
        })
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1 pr-4">
                    <CardTitle>Supervision Contracts</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                        Manage student contracts and team assignments.
                        <Badge variant="outline" className={cn(
                            "text-[10px] font-bold",
                            studentPlanType === "CONCENTRATED"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                            {studentPlanType} Plan
                        </Badge>
                    </CardDescription>
                </div>
                <Button size="sm" onClick={handleCreateNew}>
                    <Plus className="mr-2 h-4 w-4" /> New Contract
                </Button>
            </CardHeader>
            <CardContent>
                {(contracts || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/10 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium text-muted-foreground">No contracts found</p>
                        <Button variant="link" onClick={handleCreateNew}>Click here to create the first one</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(contracts || []).map(contract => {
                            if (!contract?.id) return null
                            const primarySup = contract.supervisors?.find(s => s.isMainSupervisor)
                            const secondarySups = contract.supervisors?.filter(s => !s.isMainSupervisor) || []
                            const groupAssigns = contract.groupAssignments || []

                            return (
                                <div key={safe(contract.id)} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
                                    {/* Header row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-semibold text-sm">
                                                    Effective: {(() => {
                                                        try {
                                                            const dt = new Date(contract.effectiveDate as any)
                                                            if (isNaN(dt.getTime())) return "N/A"
                                                            const utcDate = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
                                                            return format(utcDate, "MMMM d, yyyy")
                                                        } catch { return "N/A" }
                                                    })()}
                                                </span>
                                                <Badge variant={STATUS_COLORS[safe(contract.status)] as any ?? "secondary"}>
                                                    {safe(contract.status || "ACTIVE")}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground uppercase">
                                                ID: {safe(contract.id).slice(0, 8)}
                                                {" · "}Created: {(() => {
                                                    try {
                                                        const d = new Date(contract.createdAt as any)
                                                        return !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "N/A"
                                                    } catch { return "N/A" }
                                                })()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {contract.status === "REJECTED" && (
                                                <Button variant="default" size="sm" className="h-8 gap-1.5"
                                                    onClick={() => handleResend(contract.id)} disabled={isPending}>
                                                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                    Resend
                                                </Button>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(contract)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-8 px-3 gap-1.5" asChild>
                                                <a href={`/api/contracts/${safe(contract.id)}/download`} target="_blank" rel="noreferrer">
                                                    <Download className="h-4 w-4" /> Download
                                                </a>
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteClick(contract.id)}
                                                disabled={deletingId === safe(contract.id) && isPending}>
                                                {deletingId === safe(contract.id) && isPending
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Rejection reason */}
                                    {contract.status === "REJECTED" && contract.rejectionReason && (
                                        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm">
                                            <div className="flex items-center gap-2 text-destructive font-semibold mb-1">
                                                <XCircle className="h-4 w-4" /> Student Rejection Note
                                            </div>
                                            <p className="text-muted-foreground italic">"{contract.rejectionReason}"</p>
                                        </div>
                                    )}

                                    {/* Team display */}
                                    <div className="pt-2 border-t space-y-3">
                                        {/* Individual supervisors */}
                                        {(primarySup || secondarySups.length > 0) && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Individual Supervision</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {primarySup && (
                                                        <div className="flex items-center gap-1.5 rounded-lg border bg-yellow-50 border-yellow-200 px-3 py-2 w-fit">
                                                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                            <span className="text-xs font-semibold">{safe(primarySup.supervisor?.fullName)}</span>
                                                            <span className="text-[10px] text-muted-foreground">{safe(primarySup.supervisor?.credentialType)}</span>
                                                        </div>
                                                    )}
                                                    {secondarySups.map((sec, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 rounded-lg border bg-sky-50 border-sky-200 px-3 py-2 w-fit">
                                                            <Star className="h-3 w-3 text-sky-500 fill-sky-400" />
                                                            <span className="text-xs font-semibold">{safe(sec.supervisor?.fullName)}</span>
                                                            <span className="text-[10px] text-muted-foreground">{safe(sec.supervisor?.credentialType)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Group supervisors */}
                                        {groupAssigns.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Group Sessions</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {groupAssigns.map((ga, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-1.5">
                                                            <Users className="h-3 w-3 text-blue-500" />
                                                            <span className="text-xs font-semibold">{safe(ga.supervisor?.fullName)}</span>
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Calendar className="h-2.5 w-2.5" />
                                                                {DAY_LABELS[ga.officeGroup?.dayOfWeek] || ga.officeGroup?.dayOfWeek}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                                <Clock className="h-2.5 w-2.5" />
                                                                {ga.officeGroup?.startTime}–{ga.officeGroup?.endTime}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>

            <ContractFormDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                studentId={safe(studentId)}
                studentPlanType={studentPlanType}
                individualOptions={individualOptions}
                groupOptions={groupOptions}
                existing={selectedContract ? {
                    id: safe(selectedContract.id),
                    effectiveDate: selectedContract.effectiveDate,
                    supervisors: (selectedContract.supervisors || []).map(s => ({
                        supervisorId: safe(s.supervisorId),
                        isMainSupervisor: !!s.isMainSupervisor
                    })),
                    groupAssignments: (selectedContract.groupAssignments || []).map(ga => ({
                        supervisorId: safe(ga.supervisorId),
                        officeGroupId: safe(ga.officeGroupId)
                    }))
                } : undefined}
            />

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Delete Contract"
                description="This will permanently delete the contract and all its assignments. This action cannot be undone."
                confirmText="Confirm Delete"
                variant="destructive"
                isLoading={isPending}
            />
        </Card>
    )
}
