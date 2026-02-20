"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, CheckCircle, XCircle, FileText, Loader2, Clock } from "lucide-react"
import { format } from "date-fns"
import { approveContract } from "@/actions/contracts"
import { RejectContractDialog } from "@/components/student/reject-contract-dialog"
import { ApproveContractDialog } from "@/components/student/approve-contract-dialog"

interface StudentContract {
    id: string
    effectiveDate: string
    status: string
    createdAt: string
    supervisors: {
        isMainSupervisor: boolean
        supervisor: { fullName: string; credentialType: string }
    }[]
}

export function StudentContractsClient({ contracts }: { contracts: StudentContract[] }) {
    const [rejectingId, setRejectingId] = useState<string | null>(null)
    const [approvingId, setApprovingId] = useState<string | null>(null)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [, startTransition] = useTransition()

    function handleApprove(id: string) {
        setApprovingId(id)
    }

    if (contracts.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium text-foreground">No Contracts Found</p>
                    <p className="text-sm">You do not have any contracts generated for you yet.</p>
                </CardContent>
            </Card>
        )
    }

    const STATUS_COLORS: Record<string, string> = {
        DRAFT: "secondary",
        ACTIVE: "success",
        SENT: "default", // or primary-like
        SIGNED: "outline",
    }

    return (
        <div className="space-y-4">
            {contracts.map(contract => (
                <Card key={contract.id} className={contract.status === "SENT" ? "border-primary shadow-sm" : ""}>
                    <CardHeader className="flex flex-row items-start justify-between pb-4 border-b">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                Supervision Contract
                                <Badge variant={STATUS_COLORS[contract.status] as any || "secondary"}>
                                    {contract.status === "SENT" ? "ACTION REQUIRED" : contract.status}
                                </Badge>
                            </CardTitle>
                            <CardDescription className="mt-1">
                                Effective Date: {format(new Date(contract.effectiveDate), "MMMM d, yyyy")}
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" asChild className="gap-2">
                            <a href={`/api/contracts/${contract.id}/download`} target="_blank" rel="noreferrer">
                                <Download className="h-4 w-4" />
                                {contract.status === "SENT" ? "Review PDF" : "Download PDF"}
                            </a>
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <div>
                            <p className="text-sm font-semibold mb-2 text-muted-foreground">Supervision Team</p>
                            <div className="flex flex-wrap gap-2">
                                {contract.supervisors.map((cs, idx) => (
                                    <div key={idx} className="text-xs bg-muted border px-2.5 py-1.5 rounded-md flex items-center gap-2">
                                        <span className="font-medium">{cs.supervisor.fullName}</span>
                                        <span className="text-muted-foreground">({cs.supervisor.credentialType})</span>
                                        {cs.isMainSupervisor && <Badge variant="secondary" className="px-1 text-[10px]">Primary</Badge>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {contract.status === "SENT" && (
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Signature Required</p>
                                        <p className="text-xs text-muted-foreground">Please review the contract PDF. If everything is correct, click Approve to sign it digitally.</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        className="w-full sm:w-auto text-destructive border-destructive hover:bg-destructive/10"
                                        onClick={() => setRejectingId(contract.id)}
                                        disabled={pendingId !== null}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" /> Reject
                                    </Button>
                                    <Button
                                        className="w-full sm:w-auto"
                                        onClick={() => handleApprove(contract.id)}
                                        disabled={pendingId !== null}
                                    >
                                        {pendingId === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                        Approve & Sign
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}

            {rejectingId && (
                <RejectContractDialog
                    contractId={rejectingId}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) setRejectingId(null)
                    }}
                />
            )}

            {approvingId && (
                <ApproveContractDialog
                    contractId={approvingId}
                    open={true}
                    onOpenChange={(open) => {
                        if (!open) setApprovingId(null)
                    }}
                />
            )}
        </div>
    )
}
