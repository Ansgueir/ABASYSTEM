"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Edit2, Trash2, CheckCircle2, AlertCircle, Loader2, Sparkles, DollarSign, Clock, Calculator, TrendingUp, Percent } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface Plan {
    id: string
    name: string
    fieldworkType: string
    // Inputs
    totalHours: number | null
    hoursPerMonth: number | null
    supervisedPercentage: number | null
    hourlyRate: number | null
    enrollmentFee: number | null
    supervisorCommission: number | null
    // Auto-calculated
    numberOfMonths: number | null
    amountSupHours: number | null
    totalCost: number | null
    supervisionNet: number | null
    monthlyPayment: number | null
    // Legacy
    regHoursBcba: number
    regHoursBcaba: number
    concHours: number
    totalCharge: any
    totalMonths: number
}

interface FormInputs {
    name: string
    fieldworkType: string
    totalHours: string
    hoursPerMonth: string
    supervisedPercentage: string
    hourlyRate: string
    enrollmentFee: string
    supervisorCommission: string
}

/** Mirror of the backend formula — runs instantly in the browser */
function computeLive(inputs: FormInputs) {
    const totalHours = parseFloat(inputs.totalHours)
    const hoursPerMonth = parseFloat(inputs.hoursPerMonth)
    const supervisedPercentage = parseFloat(inputs.supervisedPercentage) / 100 // UI shows %, e.g. "5" → 0.05
    const hourlyRate = parseFloat(inputs.hourlyRate)
    const enrollmentFee = parseFloat(inputs.enrollmentFee)

    if (!totalHours || !hoursPerMonth || isNaN(supervisedPercentage) || !hourlyRate || isNaN(enrollmentFee)) {
        return null
    }

    const numberOfMonths = Math.ceil(totalHours / hoursPerMonth)
    const amountSupHours = totalHours * supervisedPercentage
    const totalCost = amountSupHours * hourlyRate
    const supervisionNet = totalCost - enrollmentFee
    const monthlyPayment = numberOfMonths > 0 ? supervisionNet / numberOfMonths : 0

    return { numberOfMonths, amountSupHours, totalCost, supervisionNet, monthlyPayment }
}

const fmtUSD = (n: number | null | undefined) =>
    n != null ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"

const fmtHours = (n: number | null | undefined) =>
    n != null ? `${Number(n).toFixed(1)}h` : "—"

const emptyForm: FormInputs = {
    name: "",
    fieldworkType: "REGULAR",
    totalHours: "",
    hoursPerMonth: "",
    supervisedPercentage: "",
    hourlyRate: "",
    enrollmentFee: "",
    supervisorCommission: "",
}

export function PlansTab() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState<FormInputs>(emptyForm)

    // Live calculator — mirrors backend formula exactly
    const liveCalc = useMemo(() => computeLive(formData), [formData])

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
        } catch {
            toast.error("Network error loading plans")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadPlans() }, [loadPlans])

    const handleOpenCreate = () => {
        setEditingPlan(null)
        setFormData(emptyForm)
        setDialogOpen(true)
    }

    const handleOpenEdit = (plan: Plan) => {
        setEditingPlan(plan)
        setFormData({
            name: plan.name,
            fieldworkType: plan.fieldworkType || "REGULAR",
            totalHours: plan.totalHours?.toString() ?? "",
            hoursPerMonth: plan.hoursPerMonth?.toString() ?? "",
            // supervisedPercentage stored as 0.05, show as 5 in UI
            supervisedPercentage: plan.supervisedPercentage != null ? (Number(plan.supervisedPercentage) * 100).toFixed(2) : "",
            hourlyRate: plan.hourlyRate?.toString() ?? "",
            enrollmentFee: plan.enrollmentFee?.toString() ?? "",
            // supervisorCommission stored as 0.60, show as 60 in UI
            supervisorCommission: plan.supervisorCommission != null ? (Number(plan.supervisorCommission) * 100).toFixed(0) : "",
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.name.trim()) return toast.error("Plan name is required")
        if (!formData.totalHours || !formData.hoursPerMonth) return toast.error("Total hours and hours per month are required")

        setIsSaving(true)
        try {
            const payload = {
                ...formData,
                // Convert from UI representation back to decimals
                supervisedPercentage: formData.supervisedPercentage ? (parseFloat(formData.supervisedPercentage) / 100).toString() : "",
                supervisorCommission: formData.supervisorCommission ? (parseFloat(formData.supervisorCommission) / 100).toString() : "",
            }

            const url = editingPlan ? `/api/office/plans/${editingPlan.id}` : "/api/office/plans"
            const method = editingPlan ? "PATCH" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            const data = await res.json()
            if (data.success) {
                toast.success(editingPlan ? "Plan updated!" : "Plan created!")
                setDialogOpen(false)
                loadPlans()
            } else {
                toast.error(data.error || "Operation failed")
            }
        } catch {
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
                toast.success("Plan deleted")
                setDeleteDialogOpen(false)
                loadPlans()
            } else {
                toast.error(data.error || "Delete failed")
            }
        } catch {
            toast.error("Network error deleting plan")
        } finally {
            setIsSaving(false)
        }
    }

    const F = (field: keyof FormInputs) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData(p => ({ ...p, [field]: e.target.value }))

    const isLimitReached = plans.length >= 14

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Plan Templates Manager
                    </h2>
                    <p className="text-sm text-muted-foreground">Waterfall Math Engine — auto-calculates monthly quota & supervisor ledger caps</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant={isLimitReached ? "destructive" : "secondary"} className="h-7">
                        {plans.length} / 14 Plans
                    </Badge>
                    <Button onClick={handleOpenCreate} disabled={isLimitReached} className="rounded-xl shadow-lg border-2 border-white" variant="gradient">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Plan
                    </Button>
                </div>
            </div>

            {/* ── Plans Grid ── */}
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
                                    <div className="flex flex-col gap-1">
                                        <CardTitle className="text-base font-black text-slate-800 group-hover:text-primary transition-colors">{plan.name}</CardTitle>
                                        <div className="flex items-center gap-1.5">
                                            <Badge variant="outline" className="text-[10px] font-bold border-blue-200 text-blue-700 bg-blue-50/50">
                                                {plan.numberOfMonths ?? plan.totalMonths ?? "?"} Months
                                            </Badge>
                                            <Badge variant="outline" className={`text-[10px] uppercase font-bold ${plan.fieldworkType === 'CONCENTRATED' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-green-100 text-green-700 border-green-200'}`}>
                                                {plan.fieldworkType === 'CONCENTRATED' ? 'Concentrated' : 'Regular'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(plan)}><Edit2 className="h-3 w-3" /></Button>
                                        <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setPlanToDelete(plan); setDeleteDialogOpen(true) }}><Trash2 className="h-3 w-3" /></Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-3">
                                {/* Input summary row */}
                                {plan.totalHours && (
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-slate-50 rounded-lg p-2 border">
                                            <p className="text-[9px] uppercase font-bold text-slate-500">Total Hrs</p>
                                            <p className="text-sm font-black text-slate-800">{plan.totalHours}h</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-2 border">
                                            <p className="text-[9px] uppercase font-bold text-slate-500">Hrs/Month</p>
                                            <p className="text-sm font-black text-slate-800">{plan.hoursPerMonth}h</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-2 border">
                                            <p className="text-[9px] uppercase font-bold text-slate-500">Sup %</p>
                                            <p className="text-sm font-black text-slate-800">{plan.supervisedPercentage != null ? `${(Number(plan.supervisedPercentage) * 100).toFixed(0)}%` : "—"}</p>
                                        </div>
                                    </div>
                                )}
                                {/* Financial results */}
                                <hr className="border-muted/40" />
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Sup Hours</span>
                                        <span className="font-bold">{fmtHours(plan.amountSupHours)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Total Cost</span>
                                        <span className="font-bold">{fmtUSD(plan.totalCost ?? plan.totalCharge)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Enrollment</span>
                                        <span className="font-bold text-amber-700">{fmtUSD(plan.enrollmentFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Net</span>
                                        <span className="font-bold text-blue-700">{fmtUSD(plan.supervisionNet)}</span>
                                    </div>
                                </div>
                                <hr className="border-muted/40" />
                                {/* Monthly payment highlight */}
                                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-3 border border-indigo-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-indigo-500">Monthly Payment</p>
                                        <p className="text-lg font-black text-indigo-800">{fmtUSD(plan.monthlyPayment)}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase font-bold text-indigo-500">Sup. Commission</p>
                                        <p className="text-lg font-black text-indigo-600">
                                            {plan.supervisorCommission != null ? `${(Number(plan.supervisorCommission) * 100).toFixed(0)}%` : "—"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* ─────────────────────────────────────────────────── */}
            {/* CREATE / EDIT DIALOG */}
            {/* ─────────────────────────────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[680px] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingPlan ? <Edit2 className="h-5 w-5 text-blue-500" /> : <Plus className="h-5 w-5 text-green-500" />}
                            {editingPlan ? "Modify Plan Template" : "Create New Plan Template"}
                        </DialogTitle>
                        <DialogDescription>Input variables compute the waterfall math automatically in real-time.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Row 1: Name + Type */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plan-name">Plan Name</Label>
                                <Input id="plan-name" value={formData.name} onChange={F('name')} placeholder="e.g. BCBA Supervised 1500h" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="plan-type">Fieldwork Classification</Label>
                                <select
                                    id="plan-type"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    value={formData.fieldworkType}
                                    onChange={F('fieldworkType')}
                                >
                                    <option value="REGULAR">Regular (Supervised)</option>
                                    <option value="CONCENTRATED">Concentrated</option>
                                </select>
                            </div>
                        </div>

                        {/* ── Section: Input Variables ── */}
                        <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Calculator className="h-3.5 w-3.5" /> Input Variables
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Total Hours</Label>
                                    <Input type="number" value={formData.totalHours} onChange={F('totalHours')} placeholder="e.g. 1500" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Hours Per Month</Label>
                                    <Input type="number" value={formData.hoursPerMonth} onChange={F('hoursPerMonth')} placeholder="e.g. 130" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><Percent className="h-3 w-3" /> Supervised Hours</Label>
                                    <div className="relative">
                                        <Input type="number" step="0.01" value={formData.supervisedPercentage} onChange={F('supervisedPercentage')} placeholder="e.g. 5 (= 5%)" className="pr-8" />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" /> Cost Per Hour (Rate)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">$</span>
                                        <Input type="number" step="0.01" value={formData.hourlyRate} onChange={F('hourlyRate')} placeholder="e.g. 60.00" className="pl-7" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><DollarSign className="h-3 w-3" /> Enrollment Fee (Matrícula)</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">$</span>
                                        <Input type="number" step="0.01" value={formData.enrollmentFee} onChange={F('enrollmentFee')} placeholder="e.g. 300.00" className="pl-7" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold flex items-center gap-1"><Percent className="h-3 w-3" /> Supervisor Commission %</Label>
                                    <div className="relative">
                                        <Input type="number" step="1" min="0" max="100" value={formData.supervisorCommission} onChange={F('supervisorCommission')} placeholder="e.g. 60 (= 60%)" className="pr-8" />
                                        <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-bold">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Auto-Calculated Preview ── */}
                        <div className={`rounded-xl border p-4 space-y-3 transition-all ${liveCalc ? 'border-emerald-200 bg-emerald-50/30' : 'border-dashed border-muted bg-muted/10'}`}>
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Auto-Calculated Results (Read-Only)
                            </p>
                            {!liveCalc ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                    Fill in the input variables above to see live calculations.
                                </p>
                            ) : (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white rounded-lg p-3 border text-center shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Number of Months</p>
                                        <p className="text-xl font-black text-slate-800">{liveCalc.numberOfMonths}</p>
                                        <p className="text-[10px] text-slate-400">= ⌈{formData.totalHours} ÷ {formData.hoursPerMonth}⌉</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border text-center shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Supervised Hours</p>
                                        <p className="text-xl font-black text-blue-700">{liveCalc.amountSupHours.toFixed(1)}h</p>
                                        <p className="text-[10px] text-slate-400">= {formData.totalHours}h × {formData.supervisedPercentage}%</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border text-center shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Total Cost</p>
                                        <p className="text-xl font-black text-slate-800">{fmtUSD(liveCalc.totalCost)}</p>
                                        <p className="text-[10px] text-slate-400">= {liveCalc.amountSupHours.toFixed(1)}h × ${formData.hourlyRate}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border text-center shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Supervision Net</p>
                                        <p className="text-xl font-black text-amber-700">{fmtUSD(liveCalc.supervisionNet)}</p>
                                        <p className="text-[10px] text-slate-400">= {fmtUSD(liveCalc.totalCost)} − ${formData.enrollmentFee}</p>
                                    </div>
                                    <div className="col-span-2 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-indigo-200 text-center shadow-sm">
                                        <p className="text-[10px] uppercase font-bold text-indigo-500 mb-1">📋 Monthly Payment</p>
                                        <p className="text-2xl font-black text-indigo-800">{fmtUSD(liveCalc.monthlyPayment)}</p>
                                        <p className="text-[10px] text-indigo-400">= {fmtUSD(liveCalc.supervisionNet)} ÷ {liveCalc.numberOfMonths} months</p>
                                    </div>
                                </div>
                            )}
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

            {/* ── Delete Confirm ── */}
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
