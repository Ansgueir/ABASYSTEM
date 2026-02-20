"use client"

import { useState, useTransition } from "react"
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

export function OfficeContractsTab({ studentId, contracts, allSupervisors }: OfficeContractsTabProps) {
    const router = useRouter()
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isPending, startTransition] = useTransition()

    function handleDeleteClick(id: string) {
        setDeletingId(id)
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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Supervision Contracts</CardTitle>
                    <CardDescription>
                        Manage contracts. The PDF is generated on-the-fly with current signatures — no re-signing needed when supervisors change.
                    </CardDescription>
                </div>
                <ContractFormDialog studentId={studentId} supervisors={allSupervisors} />
            </CardHeader>
            <CardContent>
                {contracts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-10 border border-dashed rounded-xl bg-muted/10 text-center">
                        <Users className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium text-muted-foreground">No contracts yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create a contract by selecting supervisors above.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {contracts.map(contract => (
                            <div
                                key={contract.id}
                                className="rounded-xl border bg-card p-5 space-y-4"
                            >
                                {/* Contract Header Row */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-semibold">
                                                Effective: {format(new Date(contract.effectiveDate), "MMMM d, yyyy")}
                                            </span>
                                            <Badge variant={STATUS_COLORS[contract.status] as any ?? "secondary"}>
                                                {contract.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Created {format(new Date(contract.createdAt), "MMM d, yyyy · HH:mm")}
                                            {" · "}Contract ID: <code className="font-mono">{contract.id.slice(0, 8)}</code>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {/* Edit */}
                                        <ContractFormDialog
                                            studentId={studentId}
                                            supervisors={allSupervisors}
                                            existing={{
                                                id: contract.id,
                                                effectiveDate: contract.effectiveDate,
                                                supervisors: contract.supervisors.map(s => ({
                                                    supervisorId: s.supervisorId,
                                                    isMainSupervisor: s.isMainSupervisor,
                                                }))
                                            }}
                                        />

                                        {/* Download PDF */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-1.5"
                                            asChild
                                        >
                                            <a href={`/api/contracts/${contract.id}/download`} target="_blank" rel="noreferrer">
                                                <Download className="h-4 w-4" />
                                                PDF
                                            </a>
                                        </Button>

                                        {/* Delete */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            disabled={deletingId === contract.id && isPending}
                                            onClick={() => handleDeleteClick(contract.id)}
                                        >
                                            {deletingId === contract.id && isPending
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <Trash2 className="h-4 w-4" />
                                            }
                                        </Button>
                                    </div>
                                </div>

                                {/* Supervisors Grid */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        Assigned Supervisors ({contract.supervisors.length})
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {contract.supervisors.map(cs => (
                                            <div
                                                key={cs.supervisorId}
                                                className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-1.5"
                                            >
                                                {cs.isMainSupervisor && (
                                                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                                )}
                                                <span className="text-xs font-medium">{cs.supervisor.fullName}</span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    ({cs.supervisor.credentialType})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            {/* Reusable Confirm Dialog */}
            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleConfirmDelete}
                title="Delete Contract"
                description="Are you sure you want to delete this contract permanently? This action cannot be undone."
                confirmText="Delete Contract"
                variant="destructive"
                isLoading={isPending}
            />
        </Card>
    )
}
