"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Loader2, Sparkles, DollarSign, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface Plan {
    id: string
    name: string
    regHoursBcba: number
    regHoursBcaba: number
    concHours: number
    totalCharge: any // Using any to handle decimal from DB
    analystPayout: any
}

export function PlansTab() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    const [formData, setFormData] = useState({
        name: "",
        regHoursBcba: "",
        regHoursBcaba: "",
        concHours: "",
        totalCharge: "",
        analystPayout: "",
        totalMonths: ""
    })

    const loadPlans = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/office/plans")
            const data = await res.json()
            if (data.success) {
                setPlans(data.plans)
            } else {
                toast.error(data.error || "Failed to load plans")
            }
        } catch (error) {
            toast.error("Network error loading plans")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPlans()
    }, [loadPlans])

    const handleOpenCreate = () => {
        setEditingPlan(null)
        setFormData({
            name: "",
            regHoursBcba: "",
            regHoursBcaba: "",
            concHours: "",
            totalCharge: "",
            analystPayout: "",
            totalMonths: "12"
        })
        setDialogOpen(true)
    }

    const handleOpenEdit = (plan: any) => {
        setEditingPlan(plan)
        setFormData({
            name: plan.name,
            regHoursBcba: plan.regHoursBcba.toString(),
            regHoursBcaba: plan.regHoursBcaba.toString(),
            concHours: plan.concHours.toString(),
            totalCharge: plan.totalCharge.toString(),
            analystPayout: plan.analystPayout.toString(),
            totalMonths: (plan.totalMonths || 12).toString()
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        // Validation
        if (!formData.name.trim()) return toast.error("Plan name is required")
        
        setIsSaving(true)
        try {
            const url = editingPlan ? `/api/office/plans/${editingPlan.id}` : "/api/office/plans"
            const method = editingPlan ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })

            const data = await res.json()
            if (data.success) {
                toast.success(editingPlan ? "Plan updated!" : "Plan created!")
                setDialogOpen(false)
                loadPlans()
            } else {
                toast.error(data.error || "Operation failed")
            }
        } catch (error) {
            toast.error("Network error saving plan")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!planToDelete) return
        setIsSaving(true)
        try {
            const res = await fetch(`/api/office/plans/${planToDelete.id}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Plan deleted successfully")
                setDeleteDialogOpen(false)
                loadPlans()
            } else {
                toast.error(data.error || "Delete failed")
            }
        } catch (error) {
            toast.error("Network error deleting plan")
        } finally {
            setIsSaving(false)
        }
    }

    const isLimitReached = plans.length >= 14

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Plan Templates Manager
                    </h2>
                    <p className="text-sm text-muted-foreground">Define reusable plans to automate student onboarding calculations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={isLimitReached ? "destructive" : "secondary"} className="h-7">
                        {plans.length} / 14 Plans
                    </Badge>
                    <Button 
                        onClick={handleOpenCreate} 
                        disabled={isLimitReached}
                        className="rounded-xl shadow-lg border-2 border-white"
                        variant="gradient"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Plan
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/20 rounded-3xl border border-dashed border-muted">
                    <Loader2 className="h-10 w-10 animate-spin mb-4 opacity-50" />
                    <p className="font-medium animate-pulse">Syncing plans database...</p>
                </div>
            ) : plans.length === 0 ? (
                <Card className="border-dashed py-20 flex flex-col items-center justify-center bg-muted/5">
                    <div className="bg-muted p-4 rounded-full mb-4">
                        <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <p className="text-muted-foreground font-medium">No plans defined yet.</p>
                    <Button variant="link" onClick={handleOpenCreate} className="mt-2 text-primary">Get started by creating your first plan</Button>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((plan: any) => (
                        <Card key={plan.id} className="group overflow-hidden hover:shadow-xl transition-all border-muted/60 relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-amber-500 hidden group-hover:block" />
                            <CardHeader className="pb-3 bg-muted/10">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                                            <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50/50">
                                                {plan.totalMonths || 12} Months
                                            </Badge>
                                        </div>
                                        <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2 group-hover:text-primary transition-colors">{plan.name}</CardTitle>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(plan)}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setPlanToDelete(plan); setDeleteDialogOpen(true); }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col items-center">
                                        <span className="text-[10px] uppercase font-bold text-blue-600 mb-1">BCBA Regular Hours</span>
                                        <span className="text-sm font-black text-blue-900">{plan.regHoursBcba}h</span>
                                    </div>
                                    <div className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 flex flex-col items-center">
                                        <span className="text-[10px] uppercase font-bold text-indigo-600 mb-1">BCaBA Regular Hours</span>
                                        <span className="text-sm font-black text-indigo-900">{plan.regHoursBcaba}h</span>
                                    </div>
                                    <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100 flex flex-col items-center">
                                        <span className="text-[10px] uppercase font-bold text-amber-600 mb-1">Concentrated hours</span>
                                        <span className="text-sm font-black text-amber-900">{plan.concHours}h</span>
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-dashed">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <DollarSign className="h-3 w-3" />
                                            <span>Client Charge (Contract)</span>
                                        </div>
                                        <span className="font-bold text-sm">$ {Number(plan.totalCharge).toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                            <span>Analyst Payout</span>
                                        </div>
                                        <span className="font-bold text-sm text-green-700">$ {Number(plan.analystPayout).toFixed(2)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingPlan ? <Edit2 className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-green-500" />}
                            {editingPlan ? "Modify Plan Template" : "Create New Plan Template"}
                        </DialogTitle>
                        <DialogDescription>Setup your plan targets and financial defaults.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Plan Name</Label>
                            <Input 
                                id="name" 
                                value={formData.name} 
                                onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. SILVER 40H / MONTH" 
                            />
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-2 col-span-1">
                                <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> BCBA
                                </Label>
                                <Input 
                                    type="number" 
                                    value={formData.regHoursBcba}
                                    onChange={(e) => setFormData(p => ({ ...p, regHoursBcba: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> BCaBA
                                </Label>
                                <Input 
                                    type="number" 
                                    value={formData.regHoursBcaba}
                                    onChange={(e) => setFormData(p => ({ ...p, regHoursBcaba: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Conc.
                                </Label>
                                <Input 
                                    type="number" 
                                    value={formData.concHours}
                                    onChange={(e) => setFormData(p => ({ ...p, concHours: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2 col-span-1">
                                <Label className="text-[11px] uppercase font-bold text-muted-foreground">Months</Label>
                                <Input 
                                    type="number" 
                                    placeholder="12"
                                    value={formData.totalMonths}
                                    onChange={(e) => setFormData(p => ({ ...p, totalMonths: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="totalCharge" className="text-blue-700 flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" /> Client Total Charge
                                </Label>
                                <Input 
                                    id="totalCharge" 
                                    type="number" 
                                    value={formData.totalCharge}
                                    onChange={(e) => setFormData(p => ({ ...p, totalCharge: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="analystPayout" className="text-green-700 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Analyst Payout
                                </Label>
                                <Input 
                                    id="analystPayout" 
                                    type="number"
                                    value={formData.analystPayout}
                                    onChange={(e) => setFormData(p => ({ ...p, analystPayout: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button variant="gradient" onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {editingPlan ? "Update Plan" : "Create Master Plan"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertCircle className="h-5 w-5" />
                            Delete Plan?
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-bold text-foreground">"{planToDelete?.name}"</span>? 
                            This won't affect existing contracts, but the plan will no longer be available for new enrollments.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Keep Plan</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
                            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
