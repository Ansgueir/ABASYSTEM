"use client"

import { Document, DocumentType } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, CheckCircle, XCircle, ExternalLink, AlertCircle, Loader2 } from "lucide-react"
import { reviewDocument } from "@/actions/documents"
import { format } from "date-fns"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface SupervisorDocumentReviewProps {
    documents: Document[]
}

export function SupervisorDocumentReview({ documents }: SupervisorDocumentReviewProps) {
    const router = useRouter()
    const [actionId, setActionId] = useState<string | null>(null)

    async function handleReview(id: string, status: "APPROVED" | "REJECTED") {
        setActionId(id)
        // @ts-ignore
        await reviewDocument(id, status)
        setActionId(null)
        router.refresh()
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Document Review</CardTitle>
                <CardDescription>Review and validate student documents.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {documents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        No documents uploaded yet.
                    </div>
                ) : (
                    documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                            <div className="flex items-center gap-4">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{doc.documentType.replace(/_/g, " ")}</p>
                                        <Badge variant={doc.status === 'APPROVED' ? 'default' : doc.status === 'REJECTED' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                                            {doc.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{doc.fileName} • {format(new Date(doc.uploadedAt), "MMM d, yyyy")}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" asChild title="View">
                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>

                                {doc.status !== 'APPROVED' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-success hover:text-success/90 hover:bg-success/10"
                                        onClick={() => handleReview(doc.id, "APPROVED")}
                                        disabled={actionId === doc.id}
                                        title="Approve"
                                    >
                                        {actionId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                    </Button>
                                )}

                                {doc.status !== 'REJECTED' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                        onClick={() => handleReview(doc.id, "REJECTED")}
                                        disabled={actionId === doc.id}
                                        title="Reject"
                                    >
                                        {actionId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )
}
