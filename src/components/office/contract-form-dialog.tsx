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
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Loader2, Star, Check } from "lucide-react"
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
    studentId: string
    supervisors: Supervisor[]
    existing?: ExistingContract
}

export function ContractFormDialog({ studentId, supervisors, existing }: ContractFormDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const isEditing = !!existing

    const [selectedIds, setSelectedIds] = useState<string[]>(() => {
        try { return (existing?.supervisors || []).map(s => String(s.supervisorId || "")) } catch { return [] }
    })
    const [mainId, setMainId] = useState<string>(() => {
        try { return String(existing?.supervisors.find(s => s.isMainSupervisor)?.supervisorId || "") } catch { return "" }
    })
    const [effectiveDate, setEffectiveDate] = useState<string>(() => {
        try {
            if (!existing) return new Date().toISOString().split("T")[0];
            const d = new Date(existing.effectiveDate as any);
            return !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : new Date().toISOString().split("T")[0];
        } catch {
            return new Date().toISOString().split("T")[0];
        }
    })

    function toggleSupervisor(id: string) {
        const sid = String(id || "")
        setSelectedIds(prev => {
            const next = prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
            if (!next.includes(String(mainId))) setMainId(next[0] ?? "")
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
                result = await updateContract({ contractId: String(existing!.id), supervisorIds: selectedIds, mainSupervisorId: String(mainId), effectiveDate })
            } else {
                result = await createContract({ studentId: String(studentId), supervisorIds: selectedIds, mainSupervisorId: String(mainId), effectiveDate })
            }
            if (result?.error) { setError(String(result.error)); return }
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {isEditing ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Pencil className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button size="sm" className="h-8">
                        <Plus className="mr-2 h-4 w-4" /> New Contract
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Assignment" : "Assign Supervisors"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Effective Date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="effectiveDate">Assignment Effective Date</Label>
                        <Input
                            id="effectiveDate"
                            type="date"
                            value={String(effectiveDate || "")}
                            onChange={e => setEffectiveDate(String(e.target.value))}
                        />
                    </div>

                    {/* Supervisor multi-select */}
                    <div className="space-y-1.5">
                        <Label>Select Team</Label>
                        <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                            {(supervisors || []).map(sup => {
                                if (!sup || !sup.id) return null;
                                const sid = String(sup.id)
                                const isSelected = selectedIds.includes(sid)
                                const isMain = String(mainId) === sid
                                return (
                                    <div
                                        key={sid}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                            isSelected
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40 hover:bg-muted/30"
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
                                            <p className="text-sm font-bold leading-none">{String(sup.fullName || "Unnamed")}</p>
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                {String(sup.credentialType || "")} · # {String(sup.bacbId || "N/A")}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setMainId(sid) }}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    isMain ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"
                                                )}
                                            >
                                                <Star className="h-4 w-4" fill={isMain ? "currentColor" : "none"} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {error && <p className="text-sm font-medium text-destructive">{String(error)}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Selection" : "Confirm Assignment"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
