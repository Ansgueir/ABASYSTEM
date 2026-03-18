"use client"

import { useState } from "react"
import { Eye, Download, Trash2, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteDocument } from "@/actions/documents"
import { toast } from "sonner"
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
    fileName
}: {
    documentId: string,
    fileUrl: string,
    fileName: string
}) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const isPdf = fileName.toLowerCase().endsWith(".pdf")
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)
    const viewUrl = `/api/documents/${documentId}/view`

    const handleDelete = async () => {
        setIsDeleting(true)
        const res = await deleteDocument(documentId)
        setIsDeleting(false)

        if (res.success) {
            toast.success("Document deleted successfully")
        } else {
            toast.error(res.error || "Failed to delete document")
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

            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                title="Delete Document"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
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
                description={`This action cannot be undone. This will permanently delete "${fileName}".`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="destructive"
                isLoading={isDeleting}
            />
        </div>
    )
}
