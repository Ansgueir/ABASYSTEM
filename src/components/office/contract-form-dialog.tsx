"use client"

import { useState, useTransition } from "react"
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

    const isEditing = !!existing

    const [selectedIds, setSelectedIds] = useState<string[]>(
        existing?.supervisors.map(s => s.supervisorId) ?? []
    )
    const [mainId, setMainId] = useState<string>(
        existing?.supervisors.find(s => s.isMainSupervisor)?.supervisorId ?? ""
    )
    const [effectiveDate, setEffectiveDate] = useState<string>(
        existing ? new Date(existing.effectiveDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    )

    function toggleSupervisor(id: string) {
        setSelectedIds(prev => {
            const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
            if (!next.includes(mainId)) setMainId(next[0] ?? "")
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
                result = await updateContract({ contractId: existing!.id, supervisorIds: selectedIds, mainSupervisorId: mainId, effectiveDate })
            } else {
                result = await createContract({ studentId, supervisorIds: selectedIds, mainSupervisorId: mainId, effectiveDate })
            }
            if (result?.error) { setError(result.error); return }
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
                    <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" /> New Contract
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Contract" : "New Supervision Contract"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Effective Date */}
                    <div className="space-y-1.5">
                        <Label htmlFor="effectiveDate">Effective Date</Label>
                        <Input
                            id="effectiveDate"
                            type="date"
                            value={effectiveDate}
                            onChange={e => setEffectiveDate(e.target.value)}
                        />
                    </div>

                    {/* Supervisor multi-select */}
                    <div className="space-y-1.5">
                        <Label>Assign Supervisors</Label>
                        <p className="text-xs text-muted-foreground">Click to select. Click ★ to set as primary supervisor.</p>
                        <div className="grid gap-2 max-h-60 overflow-y-auto pr-1">
                            {supervisors.map(sup => {
                                const isSelected = selectedIds.includes(sup.id)
                                const isMain = mainId === sup.id
                                return (
                                    <div
                                        key={sup.id}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                                            isSelected
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/40 hover:bg-muted/30"
                                        )}
                                        onClick={() => toggleSupervisor(sup.id)}
                                    >
                                        <div className={cn(
                                            "h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                            isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                                        )}>
                                            {isSelected && <Check className="h-3 w-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-none">{sup.fullName}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{sup.credentialType} · BACB # {sup.bacbId}</p>
                                        </div>
                                        {isSelected && (
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); setMainId(sup.id) }}
                                                className={cn(
                                                    "p-1 rounded transition-colors",
                                                    isMain ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-400"
                                                )}
                                                title="Set as primary supervisor"
                                            >
                                                <Star className="h-4 w-4" fill={isMain ? "currentColor" : "none"} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {selectedIds.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {selectedIds.length} supervisor(s) selected.
                                {mainId && ` Primary: ${supervisors.find(s => s.id === mainId)?.fullName}.`}
                            </p>
                        )}
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={pending}>
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Changes" : "Create Contract"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
