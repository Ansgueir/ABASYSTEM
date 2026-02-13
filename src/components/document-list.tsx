"use client"

import { Document, DocumentType } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, CheckCircle, ExternalLink, Trash2, AlertCircle } from "lucide-react"
import { UploadDocumentDialog } from "./upload-document-dialog"
import { deleteDocument } from "@/actions/documents"
import { format } from "date-fns"
import { useState } from "react"
import { useRouter } from "next/navigation"

interface DocumentListProps {
    documents: Document[]
}

const REQUIRED_DOCS = [
    { type: DocumentType.IDENTIFICATION, label: "Identification (ID/Driver's License)", description: "Required for contract generation" },
    { type: DocumentType.PROOF_START_DATE, label: "Proof of Start Date", description: "Required for contract generation" },
    { type: DocumentType.ACADEMIC_DEGREE, label: "Academic Degree", description: "Required for contract generation" },
]

export function DocumentList({ documents }: DocumentListProps) {
    const router = useRouter()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    async function handleDelete(id: string) {
        if (!confirm("Are you sure you want to delete this document?")) return
        setDeletingId(id)
        // @ts-ignore
        await deleteDocument(id)
        setDeletingId(null)
        router.refresh()
    }

    return (
        <div className="space-y-6">
            {/* Required Documents Section */}
            <Card className="border-l-4 border-l-primary/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-primary" />
                        Required Documents for Contract
                    </CardTitle>
                    <CardDescription>
                        Please upload these documents to generate your supervision contract.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {REQUIRED_DOCS.map((req) => {
                        const doc = documents.find(d => d.documentType === req.type)
                        const isUploaded = !!doc

                        return (
                            <div key={req.type} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className={`mt-1 rounded-full p-1 ${isUploaded ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                                        {isUploaded ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
                                    </div>
                                    <div>
                                        <p className="font-medium leading-none">{req.label}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{req.description}</p>
                                        {doc && (
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <FileText className="h-3 w-3" />
                                                    {doc.fileName}
                                                </div>
                                                <span>•</span>
                                                <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                                                <Badge variant={doc.status === 'APPROVED' ? 'default' : doc.status === 'REJECTED' ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 h-4">
                                                    {doc.status}
                                                </Badge>
                                            </div>
                                        )}
                                    </div>

                                </div>
                                <div>
                                    {doc ? (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="icon" asChild>
                                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive/90"
                                                onClick={() => handleDelete(doc.id)}
                                                disabled={deletingId === doc.id}
                                            >
                                                {deletingId === doc.id ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    ) : (
                                        <UploadDocumentDialog defaultType={req.type as any} />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Other Documents Section */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Other Documents</CardTitle>
                        <CardDescription>Additional uploaded files.</CardDescription>
                    </div>
                    <UploadDocumentDialog />
                </CardHeader>
                <CardContent>
                    {documents.filter(d => !REQUIRED_DOCS.find(r => r.type === d.documentType)).length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No other documents uploaded.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {documents.filter(d => !REQUIRED_DOCS.find(r => r.type === d.documentType)).map(doc => (
                                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-8 w-8 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium text-sm">{doc.fileName}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{doc.documentType.replace(/_/g, " ")}</Badge>
                                                <span>{format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
                                                <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="ghost" size="icon" asChild>
                                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive/90"
                                            onClick={() => handleDelete(doc.id)}
                                            disabled={deletingId === doc.id}
                                        >
                                            {deletingId === doc.id ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
