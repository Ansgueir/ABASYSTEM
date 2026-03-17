"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Trash2, Users, Calendar, Loader2, Star } from "lucide-react"
import { format } from "date-fns"
import { deleteContract } from "@/actions/contracts"
import { ContractFormDialog } from "@/components/office/contract-form-dialog"
import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

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
}

/** HELPER: Force any value to be a safe React child (preventing {month, year} crash) */
function safeRender(val: any): string {
    if (val === null || val === undefined) return ""
    if (typeof val === "object") {
        try {
            // Detect {month, year} or similar non-renderable children
            if (val.month !== undefined && val.year !== undefined) {
                return `Period: ${val.month}/${val.year}`
            }
            if (val.id) return String(val.id)
            return JSON.stringify(val)
        } catch {
            return "[Invalid Object]"
        }
    }
    return String(val)
}

export function OfficeContractsTab({ studentId, contracts, allSupervisors }: OfficeContractsTabProps) {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    function handleDeleteClick(id: string) {
        setDeletingId(safeRender(id))
        setShowDeleteConfirm(true)
    }

    function handleConfirmDelete() {
        if (!deletingId) return
        startTransition(async () => {
            await deleteContract(deletingId)
            setShowDeleteConfirm(false)
            setDeletingId(null)
            router.refresh()
        })
    }

    // Safety check for allSupervisors to prevent prop injection issues
    const safeAllSupervisors = (allSupervisors || []).filter(s => s && s.id)

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex-1 pr-4">
                    <CardTitle>Supervision Contracts {process.env.NODE_ENV === 'development' ? '(Dev)' : ''}</CardTitle>
                    <CardDescription>
                        Manage student contracts for individual and group supervision. 
                        V2.0 Safety Enabled.
                    </CardDescription>
                </div>
                <ContractFormDialog studentId={safeRender(studentId)} supervisors={safeAllSupervisors} />
            </CardHeader>
            <CardContent>
                {(contracts || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-xl bg-muted/10 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium text-muted-foreground">No contracts found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Use the button above to assign supervisors and create a contract.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(contracts || []).map(contract => {
                            if (!contract || !contract.id) return null
                            return (
                                <div
                                    key={safeRender(contract.id)}
                                    className="rounded-xl border bg-card p-5 space-y-4 shadow-sm"
                                >
                                    {/* Contract Header Row */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-semibold text-sm">
                                                    Effective: {(() => {
                                                        try {
                                                            const d = new Date(contract.effectiveDate as any)
                                                            return !isNaN(d.getTime()) ? format(d, "MMMM d, yyyy") : "Date Missing"
                                                        } catch {
                                                            return "Invalid Date Format"
                                                        }
                                                    })()}
                                                </span>
                                                <Badge variant={STATUS_COLORS[safeRender(contract.status)] as any ?? "secondary"}>
                                                    {safeRender(contract.status || "PENDING")}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                ID: <code className="font-mono bg-muted px-1">{safeRender(contract.id).slice(0, 8)}</code>
                                                {" · "} Created: {(() => {
                                                    try {
                                                        const d = new Date(contract.createdAt as any)
                                                        return !isNaN(d.getTime()) ? format(d, "MMM d, yyyy") : "N/A"
                                                    } catch {
                                                        return "N/A"
                                                    }
                                                })()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {/* Edit */}
                                            <ContractFormDialog
                                                studentId={safeRender(studentId)}
                                                supervisors={safeAllSupervisors}
                                                existing={{
                                                    id: safeRender(contract.id),
                                                    effectiveDate: contract.effectiveDate as any,
                                                    supervisors: (contract.supervisors || []).map(s => ({
                                                        supervisorId: safeRender(s.supervisorId),
                                                        isMainSupervisor: !!s.isMainSupervisor,
                                                    }))
                                                }}
                                            />

                                            {/* Download PDF */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-8 px-3 gap-1.5"
                                                asChild
                                            >
                                                <a href={`/api/contracts/${safeRender(contract.id)}/download`} target="_blank" rel="noreferrer">
                                                    <Download className="h-4 w-4" />
                                                    Download
                                                </a>
                                            </Button>

                                            {/* Delete */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                disabled={deletingId === safeRender(contract.id) && isPending}
                                                onClick={() => handleDeleteClick(contract.id)}
                                            >
                                                {deletingId === safeRender(contract.id) && isPending
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <Trash2 className="h-4 w-4" />
                                                }
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Supervisors Grid */}
                                    <div className="pt-2 border-t mt-2">
                                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                                            Supervision Team
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {(contract.supervisors || []).map(cs => {
                                                if (!cs || !cs.supervisor) return null;
                                                return (
                                                    <div
                                                        key={safeRender(cs.supervisorId)}
                                                        className="flex items-center gap-1.5 rounded-lg border bg-muted/20 px-2.5 py-1"
                                                    >
                                                        {cs.isMainSupervisor && (
                                                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                        )}
                                                        <span className="text-xs font-semibold">{safeRender(cs.supervisor.fullName)}</span>
                                                        <span className="text-[10px] text-muted-foreground opacity-70">
                                                            {safeRender(cs.supervisor.credentialType)}
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
            
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Delete Contract"
                description="This will permanently remove the contract record. You can recreate it later if needed."
                confirmText="Permanently Delete"
                variant="destructive"
                isLoading={isPending}
            />
        </Card>
    )
}
