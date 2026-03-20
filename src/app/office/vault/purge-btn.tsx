"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { purgeUser } from "@/actions/purge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PurgeBtnProps {
    userId: string
    userName: string
    userEmail: string
}

export function PurgeActionBtn({ userId, userName, userEmail }: PurgeBtnProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [confirmText, setConfirmText] = useState("")

    const isConfirmed = confirmText.toUpperCase() === "PURGE"
    
    async function handlePurge() {
        if (!isConfirmed) return
        
        setIsPending(true)
        try {
            const result = await purgeUser(userId)
            if (result.success) {
                toast.success(`User ${userName} has been permanently purged.`)
                setIsOpen(false)
            } else {
                toast.error(result.error || "Failed to purge user")
            }
        } catch (error) {
            toast.error("An unexpected error occurred during destruction.")
        } finally {
            setIsPending(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Purge
                </Button>
            </DialogTrigger>
            <DialogContent className="border-destructive/50 ring-destructive/20 ring-offset-destructive">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-destructive mb-2">
                        <AlertTriangle className="h-6 w-6" />
                        <DialogTitle className="text-xl font-bold">CRITICAL SYSTEM DESTRUCTION</DialogTitle>
                    </div>
                    <div className="space-y-4">
                        <p className="font-semibold text-gray-900">
                            You are about to PERMANENTLY DELETE all data associated with:
                            <br />
                            <span className="text-destructive underline decoration-2 underline-offset-4">{userName} ({userEmail})</span>
                        </p>
                        <p className="text-sm bg-destructive/5 p-4 rounded-lg border border-destructive/10 leading-relaxed text-muted-foreground">
                            This action is **irreversible**. All physical documents, timesheets, contracts, and internal logs will be physically destroyed from the server and database. Ghosting records will NOT be kept.
                        </p>
                    </div>
                </DialogHeader>
                
                <div className="py-2 space-y-3">
                    <Label htmlFor="confirm-purge" className="text-xs font-bold uppercase tracking-tight text-gray-500">
                        Type <span className="text-destructive">PURGE</span> to confirm physical destruction
                    </Label>
                    <Input
                        id="confirm-purge"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="PURGE"
                        autoFocus
                        className={confirmText === "PURGE" ? "border-destructive ring-destructive/20 focus-visible:ring-destructive" : ""}
                    />
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>Cancel Operation</Button>
                    <Button 
                        onClick={handlePurge}
                        disabled={!isConfirmed || isPending}
                        className="bg-destructive hover:bg-destructive/90 text-white font-bold"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                PURGING...
                            </>
                        ) : (
                            "CONFIRM DESTRUCTION"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
