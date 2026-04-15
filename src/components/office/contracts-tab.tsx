"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Trash2, Users, Calendar, Loader2, Star, Plus, Pencil, RotateCcw, XCircle } from "lucide-react"
import { format } from "date-fns"
import { deleteContract, resendContract } from "@/actions/contracts"
import { ContractFormDialog } from "@/components/office/contract-form-dialog"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

interface Supervisor {
    id: string
    fullName: string
    bacbId: string
    credentialType: string
}

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
    rejectionReason?: string | null
}

interface OfficeContractsTabProps {
    studentId: string
    contracts: ContractEntry[]
    allSupervisors: Supervisor[]
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "secondary",
    ACTIVE: "success",
    SENT: "default",
    SIGNED: "outline",
    REJECTED: "destructive",
}

/** Forced string conversion for any value to prevent React crashes */
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

export function OfficeContractsTab({ studentId, contracts, allSupervisors }: OfficeContractsTabProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [selectedContract, setSelectedContract] = useState<ContractEntry | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    const handleCreateNew = () => {
        setSelectedContract(null)
        setIsDialogOpen(true)
    }

    const handleEdit = (contract: ContractEntry) => {
        setSelectedContract(contract)
        setIsDialogOpen(true)
    }

    const handleDeleteClick = (id: string) => {
        setDeletingId(safe(id))
        setShowDeleteConfirm(true)
    }

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
            else {
                toast.success("Contract re-sent to student")
                router.refresh()
            }
        })
    }

    const safeSupervisors = (allSupervisors || []).filter(s => s && s.id)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1 pr-4">
                    <CardTitle>Supervision Contracts</CardTitle>
                    <CardDescription>Manage student contracts and assignments.</CardDescription>
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
                            if (!contract || !contract.id) return null
                            return (
                                <div key={safe(contract.id)} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
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
                                                {" · "} Created: {(() => {
                                                    try {
                                                        const d = new Date(contract.createdAt as any)
                                                        return !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "N/A"
                                                    } catch { return "N/A" }
                                                })()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {contract.status === "REJECTED" && (
                                                <Button 
                                                    variant="default" 
                                                    size="sm" 
                                                    className="h-8 gap-1.5" 
                                                    onClick={() => handleResend(contract.id)}
                                                    disabled={isPending}
                                                >
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
                                                disabled={deletingId === safe(contract.id) && isPending}
                                            >
                                                {deletingId === safe(contract.id) && isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>

                                    {contract.status === "REJECTED" && contract.rejectionReason && (
                                        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-sm">
                                            <div className="flex items-center gap-2 text-destructive font-semibold mb-1">
                                                <XCircle className="h-4 w-4" /> Student Rejection Note
                                            </div>
                                            <p className="text-muted-foreground italic">"{contract.rejectionReason}"</p>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t flex flex-wrap gap-2">
                                        {(contract.supervisors || []).map(cs => (
                                            <div key={safe(cs.supervisorId)} className="flex items-center gap-1.5 rounded-lg border bg-muted/20 px-2.5 py-1">
                                                {cs.isMainSupervisor && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                                <span className="text-xs font-semibold">{safe(cs.supervisor?.fullName)}</span>
                                                <span className="text-[10px] text-muted-foreground">{safe(cs.supervisor?.credentialType)}</span>
                                            </div>
                                        ))}
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
                supervisors={safeSupervisors}
                existing={selectedContract ? {
                    id: safe(selectedContract.id),
                    effectiveDate: selectedContract.effectiveDate,
                    supervisors: (selectedContract.supervisors || []).map(s => ({
                        supervisorId: safe(s.supervisorId),
                        isMainSupervisor: !!s.isMainSupervisor
                    }))
                } : undefined}
            />

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Delete Contract"
                description="This will permanently delete the contract record. This action cannot be undone."
                confirmText="Confirm Delete"
                variant="destructive"
                isLoading={isPending}
            />
        </Card>
    )
}
