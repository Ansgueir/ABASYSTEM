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
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="View Document">
                        <Eye className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 border-b">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-primary" />
                            {fileName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-4">
                        {isPdf ? (
                            <iframe
                                src={fileUrl}
                                className="w-full h-full rounded-md shadow-sm border bg-white"
                                title={fileName}
                            />
                        ) : isImage ? (
                            <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                            />
                        ) : (
                            <div className="text-center p-8 bg-card rounded-xl border shadow-sm">
                                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium">Preview not available</h3>
                                <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                                    The browser cannot preview this file type directly. Please use the download button to view the file.
                                </p>
                                <Button className="mt-6" asChild>
                                    <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download File
                                    </a>
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" title="Download Document" asChild>
                <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
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
