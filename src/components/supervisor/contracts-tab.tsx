"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Calendar, Users, Star, FileText } from "lucide-react"
import { format } from "date-fns"

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

interface SupervisorContractsTabProps {
    contracts: ContractEntry[]
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: "secondary",
    ACTIVE: "success",
    SENT: "default",
    SIGNED: "outline",
    REJECTED: "destructive",
    APPROVED: "success",
}

export function SupervisorContractsTab({ contracts }: SupervisorContractsTabProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Supervision Contracts</CardTitle>
                <CardDescription>View all supervision contracts and their current status for this student.</CardDescription>
            </CardHeader>
            <CardContent>
                {(contracts || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/10 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mb-3" />
                        <p className="font-medium text-muted-foreground">No contracts found for this student.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {(contracts || []).map(contract => (
                            <div key={contract.id} className="rounded-xl border bg-card p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            <span className="font-semibold text-sm">
                                                Effective: {(() => {
                                                    const dt = new Date(contract.effectiveDate)
                                                    const utcDate = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
                                                    return format(utcDate, "MMMM d, yyyy")
                                                })()}
                                            </span>
                                            <Badge variant={STATUS_COLORS[contract.status] as any ?? "secondary"}>
                                                {contract.status}
                                            </Badge>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                            ID: {contract.id.slice(0, 8)} 
                                            {" · "} Generated: {format(new Date(contract.createdAt), "MMM d, yyyy")}
                                        </p>
                                    </div>

                                    <Button variant="outline" size="sm" className="h-8 px-3 gap-1.5" asChild>
                                        <a href={`/api/contracts/${contract.id}/download`} target="_blank" rel="noreferrer">
                                            <Download className="h-4 w-4" /> View / Download
                                        </a>
                                    </Button>
                                </div>

                                <div className="pt-2 border-t flex flex-wrap gap-2">
                                    {(contract.supervisors || []).map(cs => (
                                        <div key={cs.supervisorId} className="flex items-center gap-1.5 rounded-lg border bg-muted/20 px-2.5 py-1">
                                            {cs.isMainSupervisor && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                                            <span className="text-xs font-semibold">{cs.supervisor?.fullName}</span>
                                            <Badge variant="outline" className="text-[10px] h-4 px-1">{cs.supervisor?.credentialType}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
