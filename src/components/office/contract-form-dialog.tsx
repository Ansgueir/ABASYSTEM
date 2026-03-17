"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Star, Check } from "lucide-react"
import { createContract, updateContract } from "@/actions/contracts"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Supervisor {
    id: string
    fullName: string
    bacbId: string
    credentialType: string
}

interface ExistingContract {
    id: string
    effectiveDate: Date
    supervisors: { supervisorId: string; isMainSupervisor: boolean }[]
}

interface ContractFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    studentId: string
    supervisors: Supervisor[]
    existing?: ExistingContract
}

/** Forced string helper for safety */
const safe = (v: any) => (v === null || v === undefined) ? "" : String(v)

export function ContractFormDialog({ open, onOpenChange, studentId, supervisors, existing }: ContractFormDialogProps) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")

    const isEditing = !!existing

    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [mainId, setMainId] = useState<string>("")
    const [effectiveDate, setEffectiveDate] = useState<string>("")

    // Reset state whenever the dialog opens or the 'existing' contract changes
    useEffect(() => {
        if (!open) return
        
        setError("")
        if (existing) {
            setSelectedIds((existing.supervisors || []).map(s => safe(s.supervisorId)))
            setMainId(safe(existing.supervisors.find(s => s.isMainSupervisor)?.supervisorId || ""))
            try {
                const d = new Date(existing.effectiveDate as any)
                setEffectiveDate(!isNaN(d.getTime()) ? d.toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
            } catch {
                setEffectiveDate(new Date().toISOString().split("T")[0])
            }
        } else {
            setSelectedIds([])
            setMainId("")
            setEffectiveDate(new Date().toISOString().split("T")[0])
        }
    }, [open, existing])

    function toggleSupervisor(id: string) {
        const sid = safe(id)
        setSelectedIds(prev => {
            const isClosing = prev.includes(sid)
            const next = isClosing ? prev.filter(x => x !== sid) : [...prev, sid]
            if (isClosing && safe(mainId) === sid) setMainId(next[0] ?? "")
            else if (!mainId && next.length > 0) setMainId(next[0])
            return next
        })
    }

    function handleSubmit() {
        setError("")
        if (selectedIds.length === 0) { setError("Select at least one supervisor."); return }
        if (!mainId) { setError("Select a primary supervisor."); return }
        if (!effectiveDate) { setError("Effective date is required."); return }

        startTransition(async () => {
            let result: any
            if (isEditing) {
                result = await updateContract({ 
                    contractId: safe(existing!.id), 
                    supervisorIds: selectedIds, 
                    mainSupervisorId: safe(mainId), 
                    effectiveDate 
                })
            } else {
                result = await createContract({ 
                    studentId: safe(studentId), 
                    supervisorIds: selectedIds, 
                    mainSupervisorId: safe(mainId), 
                    effectiveDate 
                })
            }
            if (result?.error) { setError(safe(result.error)); return }
            onOpenChange(false)
            router.refresh()
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Assignment" : "Assign Supervisors"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="effectiveDate">Assignment Effective Date</Label>
                        <Input
                            id="effectiveDate"
                            type="date"
                            value={safe(effectiveDate)}
                            onChange={e => setEffectiveDate(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Select Team</Label>
                        <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                            {(supervisors || []).map(sup => {
                                if (!sup || !sup.id) return null
                                const sid = safe(sup.id)
                                const isSelected = selectedIds.includes(sid)
                                const isMain = safe(mainId) === sid
                                return (
                                    <div
                                        key={sid}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                            isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                                        )}
                                        onClick={() => toggleSupervisor(sid)}
                                    >
                                        <div className={cn(
                                            "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                            isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold leading-none">{safe(sup.fullName) || "Unnamed"}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {safe(sup.credentialType)} · # {safe(sup.bacbId) || "N/A"}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setMainId(sid) }}
                                                className={cn("p-1 rounded transition-colors", isMain ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400")}
                                            >
                                                <Star className="h-4 w-4" fill={isMain ? "currentColor" : "none"} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {error && <p className="text-sm font-medium text-destructive">{safe(error)}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Selection" : "Confirm Assignment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
