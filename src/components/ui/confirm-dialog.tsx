"use client"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"
import { Loader2, AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (reason?: string) => void
    title?: string
    description?: string
    confirmText?: string
    cancelText?: string
    variant?: "default" | "destructive"
    isLoading?: boolean
    requireReason?: boolean
    reasonPlaceholder?: string
}

export function ConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Are you sure?",
    description = "This action cannot be undone.",
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    isLoading = false,
    requireReason = false,
    reasonPlaceholder = "Provide a reason..."
}: ConfirmDialogProps) {
    const [reason, setReason] = useState("")

    useEffect(() => {
        if (!open) setReason("")
    }, [open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className={`mx-auto w-12 h-12 ${variant === 'destructive' ? 'bg-destructive/10' : 'bg-primary/10'} rounded-full flex items-center justify-center mb-2`}>
                        <AlertTriangle className={`h-6 w-6 ${variant === 'destructive' ? 'text-destructive' : 'text-primary'}`} />
                    </div>
                    <DialogTitle className="text-center">{title}</DialogTitle>
                    <DialogDescription className="text-center pt-2">
                        {description}
                    </DialogDescription>
                </DialogHeader>

                {requireReason && (
                    <div className="py-4">
                        <Textarea
                            placeholder={reasonPlaceholder}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="min-h-[80px]"
                        />
                        {requireReason && reason.trim().length === 0 && (
                            <p className="text-xs text-destructive mt-1">A reason is required to proceed.</p>
                        )}
                    </div>
                )}

                <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                        className="sm:flex-1"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={variant}
                        onClick={() => onConfirm(reason)}
                        disabled={isLoading || (requireReason && reason.trim().length === 0)}
                        className="sm:flex-1"
                    >
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
