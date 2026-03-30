"use client"

import { useState } from "react"
import { Eye, Download, Trash2, Loader2, FileText, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteDocument, reviewDocument } from "@/actions/documents"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export function OfficeDocumentActions({
    documentId,
    fileUrl,
    fileName,
    status
}: {
    documentId: string,
    fileUrl: string,
    fileName: string,
    status: string
}) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)
    const [actionId, setActionId] = useState<string | null>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const isPdf = fileName.toLowerCase().endsWith(".pdf")
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)
    const viewUrl = `/api/documents/${documentId}/view`

    const handleDelete = async (reason?: string) => {
        setIsDeleting(true)
        const res = await deleteDocument(documentId, reason)
        setIsDeleting(false)
        setShowDeleteConfirm(false)

        if (res.success) {
            toast.success("Document deleted successfully")
            router.refresh()
        } else {
            toast.error(res.error || "Failed to delete document")
        }
    }

    const handleReview = async (id: string, newStatus: "APPROVED" | "REJECTED") => {
        let reason = ""
        if (newStatus === "REJECTED") {
            const userInput = window.prompt("Motivo del rechazo:")
            if (userInput === null) return
            if (userInput.trim() === "") {
                toast.error("Se requiere un motivo para rechazar el documento")
                return
            }
            reason = userInput
        }

        setActionId(id)
        const res = await reviewDocument(id, newStatus, reason)
        setActionId(null)

        if (res.success) {
            toast.success(`Document ${newStatus.toLowerCase()} successfully`)
            router.refresh()
        } else {
            toast.error(res.error || "Failed to review document")
        }
    }

    return (
        <div className="flex items-center gap-1 justify-end">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Open in New Tab" asChild>
                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                </a>
            </Button>


            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Download Document" asChild>
                <a href={viewUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                </a>
            </Button>

            {status !== "APPROVED" && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-success hover:text-success/90 hover:bg-success/10"
                    onClick={() => handleReview(documentId, "APPROVED")}
                    disabled={!!actionId}
                    title="Approve Document"
                >
                    {actionId === documentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                </Button>
            )}

            {status !== "REJECTED" && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                    onClick={() => handleReview(documentId, "REJECTED")}
                    disabled={!!actionId}
                    title="Reject Document"
                >
                    {actionId === documentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                </Button>
            )}

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Delete Document"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || !!actionId}
            >
                {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                ) : (
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                )}
            </Button>

            <ConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={handleDelete}
                title="Delete Document"
                description={`Are you sure you want to delete "${fileName}"? This will notify the student.`}
                confirmText="Delete Document"
                cancelText="Cancel"
                variant="destructive"
                isLoading={isDeleting}
                requireReason={true}
                reasonPlaceholder="Escribe el motivo de la eliminación..."
            />
        </div>
    )
}
