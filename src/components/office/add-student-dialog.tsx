"use client"

import { Button } from "@/components/ui/button"
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
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, Sparkles } from "lucide-react"
import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { createStudent } from "@/actions/users"

interface Plan {
    id: string
    name: string
    regHoursBcba: number
    regHoursBcaba: number
    concHours: number
    totalCharge: number
    analystPayout: number
    totalMonths: number
    fieldworkType: string
    totalHours?: number
    amountSupHours?: number
    totalCost?: number
    supervisorCommission?: number
    numberOfMonths?: number
}

interface AddStudentDialogProps {
    isSuperAdmin?: boolean
}

export function AddStudentDialog({ isSuperAdmin }: AddStudentDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [plans, setPlans] = useState<Plan[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)

    // Controlled fields for auto-fill and locking
    const [selectedPlanId, setSelectedPlanId] = useState<string>("")
    const [vcsSequence, setVcsSequence] = useState("")
    const [totalAmount, setTotalAmount] = useState("")
    const [analystRate, setAnalystRate] = useState("")
    const [officeRate, setOfficeRate] = useState("")
    const [regTarget, setRegTarget] = useState("")
    const [bcabaTarget, setBcabaTarget] = useState("")
    const [concTarget, setConcTarget] = useState("")
    const [totalMonths, setTotalMonths] = useState("12")
    const [fieldworkType, setFieldworkType] = useState("REGULAR")

    const isManual = selectedPlanId === "manual" || selectedPlanId === ""
    const isLocked = !isManual

    useEffect(() => {
        if (open) {
            setLoadingPlans(true)
            fetch("/api/office/plans")
                .then(res => res.json())
                .then(data => {
                    if (data.success) setPlans(data.plans)
                })
                .finally(() => setLoadingPlans(false))
        }
    }, [open])

    const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value
        setSelectedPlanId(val)

        if (val === "manual") {
            setVcsSequence("")
            setTotalAmount("")
            setAnalystRate("")
            setOfficeRate("")
            setRegTarget("")
            setBcabaTarget("")
            setConcTarget("")
            setTotalMonths("12")
            setFieldworkType("REGULAR")
            return
        }

        const plan = plans.find(p => p.id === val)
        if (plan) {
            setVcsSequence(plan.name)
            
            // Waterfall Math mapping
            const totalCost = Number(plan.totalCost) || Number(plan.totalCharge) || 0
            setTotalAmount(totalCost.toString())
            
            const commission = Number(plan.supervisorCommission) || 0
            if (commission > 0) {
                setAnalystRate((commission * 100).toFixed(2))
                setOfficeRate(((1 - commission) * 100).toFixed(2))
            } else if (totalCost > 0) {
                const payout = Number(plan.analystPayout) || 0
                const aRate = ((payout / totalCost) * 100)
                setAnalystRate(aRate.toFixed(2))
                setOfficeRate((100 - aRate).toFixed(2))
            } else {
                setAnalystRate("0")
                setOfficeRate("0")
            }

            const totalH = Number(plan.totalHours) || 0
            const supH = Number(plan.amountSupHours) || 0
            const indivH = Math.round(totalH - supH)

            setRegTarget(totalH.toString()) // Now acting as Total Hours
            setBcabaTarget(indivH.toString()) // Acting as Indiv Hours
            setConcTarget("0") // Redundant
            
            setTotalMonths((plan.numberOfMonths || plan.totalMonths || 12).toString())
            setFieldworkType(plan.fieldworkType || "REGULAR")
            
            toast.info(`Plan "${plan.name}" locked & applied!`, {
                icon: <Sparkles className="h-4 w-4 text-amber-500" />
            })
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        
        // Ensure locked fields are included in FormData even if disabled
        if (isLocked) {
            formData.set("vcsSequence", vcsSequence)
            formData.set("totalAmountContract", totalAmount)
            formData.set("analystPaymentRate", (Number(analystRate) / 100).toString()) // Store as decimal 0.60
            formData.set("officePaymentRate", (Number(officeRate) / 100).toString())
            formData.set("hoursTargetReg", regTarget)
            formData.set("hoursTargetConc", concTarget)
            formData.set("totalMonths", totalMonths)
        } else {
             // For manual, we still need to store rate as decimal
             const aRateValue = formData.get("analystPaymentRate")
             const oRateValue = formData.get("officePaymentRate")
             if (aRateValue) formData.set("analystPaymentRate", (Number(aRateValue) / 100).toString())
             if (oRateValue) formData.set("officePaymentRate", (Number(oRateValue) / 100).toString())
             formData.set("fieldworkType", fieldworkType)
        }

        startTransition(async () => {
            const result = await createStudent(formData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Student created successfully")
                setOpen(false)
                setSelectedPlanId("")
                setVcsSequence("")
                setTotalAmount("")
                setRegTarget("")
                setBcabaTarget("")
                setConcTarget("")
                setTotalMonths("12")
                setFieldworkType("REGULAR")
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="gradient" className="rounded-xl">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Student
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-6xl w-[95vw] gap-6">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-10 bg-primary/20 rounded-full" />
                        <DialogTitle className="text-2xl font-bold">Register Student</DialogTitle>
                    </div>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-6 py-4 max-h-[75vh] overflow-y-auto px-6 scrollbar-thin scrollbar-thumb-primary/10">
                        {/* Section: Personal Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Full Name</Label>
                                <Input id="fullName" name="fullName" placeholder="Full legal name" required className="h-10 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Email Address</Label>
                                <Input id="email" name="email" type="email" placeholder="email@example.com" required className="h-10 rounded-lg" />
                            </div>
                        </div>

                        {/* Plan Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <div className="space-y-2">
                                <Label htmlFor="planTemplateId" className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" /> CHOOSE OPTION PLAN
                                </Label>
                                <select 
                                    id="planTemplateId" 
                                    name="planTemplateId" 
                                    value={selectedPlanId}
                                    onChange={handlePlanChange}
                                    required
                                    className="flex h-10 w-full rounded-lg border-2 border-primary/20 bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/40 outline-none"
                                >
                                    <option value="">-- Click to Select Plan --</option>
                                    <option value="manual" className="font-bold text-amber-600">PLAN MANUAL (Unlock Fields)</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedOptionPlan" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Active Plan Name</Label>
                                <Input 
                                    id="assignedOptionPlan" 
                                    name="assignedOptionPlan" 
                                    value={vcsSequence} 
                                    onChange={(e) => setVcsSequence(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted/50 cursor-not-allowed font-bold text-primary" : ""}
                                />
                                <input type="hidden" name="vcsSequence" value={vcsSequence} />
                            </div>
                        </div>

                        {/* Section: Financials */}
                        <div className="p-5 bg-muted/40 rounded-xl space-y-4 border">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Financial Calibration</p>
                                {isLocked && <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px]">LOCKED BY PLAN</Badge>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="totalAmountContract" className="text-xs font-semibold">Total Cost ($)</Label>
                                    <Input 
                                        id="totalAmountContract" 
                                        name="totalAmountContract" 
                                        type="number" 
                                        step="0.01" 
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="analystPaymentRate" className="text-xs font-semibold">Sup. Commission (%)</Label>
                                    <Input 
                                        id="analystPaymentRate" 
                                        name="analystPaymentRate" 
                                        type="number" 
                                        step="0.01" 
                                        value={analystRate}
                                        onChange={(e) => setAnalystRate(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="officePaymentRate" className="text-xs font-semibold">Office Rate (%)</Label>
                                    <Input 
                                        id="officePaymentRate" 
                                        name="officePaymentRate" 
                                        type="number" 
                                        step="0.01" 
                                        value={officeRate}
                                        onChange={(e) => setOfficeRate(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="totalMonths" className="text-xs font-semibold">Duration (Months)</Label>
                                    <Input 
                                        id="totalMonths" 
                                        name="totalMonths" 
                                        type="number" 
                                        value={totalMonths}
                                        onChange={(e) => setTotalMonths(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Targets */}
                        <div className="p-5 bg-muted/40 rounded-xl space-y-4 border">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fieldwork Tracking Targets</p>
                                {isLocked && <Badge variant="secondary" className="bg-primary/10 text-primary text-[9px]">LOCKED BY PLAN</Badge>}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="hoursTargetReg" className="text-[11px] font-semibold uppercase">Total Hours</Label>
                                    <Input 
                                        id="hoursTargetReg" 
                                        name="hoursTargetReg" 
                                        type="number" 
                                        value={regTarget}
                                        onChange={(e) => setRegTarget(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="independentHoursTarget" className="text-[11px] font-semibold uppercase">Indiv. Hours</Label>
                                    <Input 
                                        id="independentHoursTarget" 
                                        name="independentHoursTarget" 
                                        type="number" 
                                        placeholder="0" 
                                        value={bcabaTarget} 
                                        onChange={(e) => setBcabaTarget(e.target.value)}
                                        readOnly={isLocked}
                                        className={isLocked ? "bg-muted/50" : ""}
                                    />
                                </div>
                                <input type="hidden" name="hoursTargetConc" value="0" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Phone Number</Label>
                                <Input id="phone" name="phone" placeholder="+1..." className="h-10 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bacbId" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">BACB ID</Label>
                                <Input id="bacbId" name="bacbId" placeholder="e.g. 1-23-45678" className="h-10 rounded-lg" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="internalComments" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Internal Comments</Label>
                            <Input id="internalComments" name="internalComments" placeholder="Add any relevant notes here..." className="h-10 rounded-lg" />
                        </div>

                        {isSuperAdmin && (
                            <div className="pt-2 border-t">
                                <div className="space-y-2">
                                    <Label htmlFor="hourlyRate" className="text-xs uppercase tracking-wider font-semibold text-primary">Hourly Rate ($)</Label>
                                    <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" placeholder="0.00" className="h-10 border-primary/30" />
                                </div>
                            </div>
                        )}
                        
                        <input type="hidden" name="city" value="Miami" />
                        <input type="hidden" name="state" value="FL" />
                        <input type="hidden" name="school" value="FSU" />
                        <input type="hidden" name="fieldworkType" value={fieldworkType} />
                        <input type="hidden" name="startDate" value={(() => {
                            const d = new Date()
                            const y = d.getFullYear()
                            const m = String(d.getMonth() + 1).padStart(2, '0')
                            const day = String(d.getDate()).padStart(2, '0')
                            return `${y}-${m}-${day}`
                        })()} />
                        <input type="hidden" name="endDate" value={(() => {
                            const d = new Date()
                            d.setFullYear(d.getFullYear() + 1)
                            const y = d.getFullYear()
                            const m = String(d.getMonth() + 1).padStart(2, '0')
                            const day = String(d.getDate()).padStart(2, '0')
                            return `${y}-${m}-${day}`
                        })()} />
                    </div>
                    <DialogFooter className="mt-4 gap-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
                        <Button type="submit" disabled={isPending} size="lg" className="px-8 rounded-xl shadow-lg shadow-primary/20">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isPending ? "Creating Profile..." : "Create Student"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
