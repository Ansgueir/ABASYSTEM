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
}

interface AddStudentDialogProps {
    isSuperAdmin?: boolean
}

export function AddStudentDialog({ isSuperAdmin }: AddStudentDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [plans, setPlans] = useState<Plan[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)

    // Controlled fields for auto-fill
    const [vcsSequence, setVcsSequence] = useState("")
    const [totalAmount, setTotalAmount] = useState("")
    const [analystRate, setAnalystRate] = useState("0.60")
    const [officeRate, setOfficeRate] = useState("0.40")
    const [regTarget, setRegTarget] = useState("")
    const [bcabaTarget, setBcabaTarget] = useState("")
    const [concTarget, setConcTarget] = useState("")

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
        const planName = e.target.value
        const plan = plans.find(p => p.name === planName)
        
        if (plan) {
            setVcsSequence(plan.name)
            setTotalAmount(plan.totalCharge.toString())
            setRegTarget(plan.regHoursBcba.toString())
            setBcabaTarget(plan.regHoursBcaba.toString()) // Mapping regHoursBcaba
            setConcTarget(plan.concHours.toString())
            
            // Calculate rates if possible
            const total = Number(plan.totalCharge)
            const payout = Number(plan.analystPayout)
            if (total > 0) {
                const aRate = (payout / total).toFixed(2)
                const oRate = (1 - Number(aRate)).toFixed(2)
                setAnalystRate(aRate)
                setOfficeRate(oRate)
            }
            
            toast.info(`Plan "${plan.name}" applied! Targets and financials updated.`, {
                icon: <Sparkles className="h-4 w-4 text-amber-500" />
            })
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)

        startTransition(async () => {
            const result = await createStudent(formData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Student created successfully")
                setOpen(false)
                // Reset states
                setVcsSequence("")
                setTotalAmount("")
                setRegTarget("")
                setBcabaTarget("")
                setConcTarget("")
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
                        <DialogTitle className="text-2xl font-bold">Add New Student V2</DialogTitle>
                    </div>
                    <DialogDescription className="text-base">
                        Create a new student profile. They will receive an email with login instructions.
                    </DialogDescription>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Phone Number</Label>
                                <Input id="phone" name="phone" placeholder="+1..." required className="h-10 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bacbId" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">BACB ID</Label>
                                <Input id="bacbId" name="bacbId" placeholder="e.g. 1-23-45678" className="h-10 rounded-lg" />
                            </div>
                        </div>

                        {/* Section: Academic/Program */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="vcsSequence" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">VCS Sequence (Auto-fill)</Label>
                                <Input 
                                    id="vcsSequence" 
                                    name="vcsSequence" 
                                    className="h-10 rounded-lg bg-muted/30" 
                                    value={vcsSequence}
                                    onChange={(e) => setVcsSequence(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedOptionPlan" className="text-xs uppercase tracking-wider font-semibold text-primary flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" /> OPTION PLAN
                                </Label>
                                <select 
                                    id="assignedOptionPlan" 
                                    name="assignedOptionPlan" 
                                    onChange={handlePlanChange}
                                    className="flex h-10 w-full rounded-lg border-2 border-primary/20 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">{loadingPlans ? "Loading plans..." : "Select a template..."}</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Section: Financials */}
                        <div className="p-5 bg-muted/40 rounded-xl space-y-4 border">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Financial Calibration</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="totalAmountContract" className="text-xs font-semibold">Total Contract ($)</Label>
                                    <Input 
                                        id="totalAmountContract" 
                                        name="totalAmountContract" 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.00" 
                                        className="h-10" 
                                        value={totalAmount}
                                        onChange={(e) => setTotalAmount(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="analystPaymentRate" className="text-xs font-semibold text-green-700">Analyst Rate (%)</Label>
                                    <Input 
                                        id="analystPaymentRate" 
                                        name="analystPaymentRate" 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.60" 
                                        className="h-10" 
                                        value={analystRate}
                                        onChange={(e) => setAnalystRate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="officePaymentRate" className="text-xs font-semibold">Office Rate (%)</Label>
                                    <Input 
                                        id="officePaymentRate" 
                                        name="officePaymentRate" 
                                        type="number" 
                                        step="0.01" 
                                        placeholder="0.40" 
                                        className="h-10" 
                                        value={officeRate}
                                        onChange={(e) => setOfficeRate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Targets */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="regularHoursTarget" className="text-[11px] font-semibold text-muted-foreground uppercase">BCBA Regular Hours</Label>
                                <Input 
                                    id="regularHoursTarget" 
                                    name="regularHoursTarget" 
                                    type="number" 
                                    placeholder="0" 
                                    className="h-9" 
                                    value={regTarget}
                                    onChange={(e) => setRegTarget(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="concentratedHoursTarget" className="text-[11px] font-semibold text-muted-foreground uppercase">Concentrated hours</Label>
                                <Input 
                                    id="concentratedHoursTarget" 
                                    name="concentratedHoursTarget" 
                                    type="number" 
                                    placeholder="0" 
                                    className="h-9" 
                                    value={concTarget}
                                    onChange={(e) => setConcTarget(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="independentHoursTarget" className="text-[11px] font-semibold text-muted-foreground uppercase">BCaBA Regular Hours</Label>
                                <Input 
                                    id="independentHoursTarget" 
                                    name="independentHoursTarget" 
                                    type="number" 
                                    placeholder="0" 
                                    className="h-9" 
                                    value={bcabaTarget}
                                    onChange={(e) => setBcabaTarget(e.target.value)}
                                />
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
                                    <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" placeholder="0.00" className="h-10 border-primary/30" required />
                                </div>
                            </div>
                        )}
                        
                        <input type="hidden" name="city" value="Miami" />
                        <input type="hidden" name="state" value="FL" />
                        <input type="hidden" name="school" value="FSU" />
                        <input type="hidden" name="supervisionType" value="REGULAR" />
                        <input type="hidden" name="startDate" value={new Date().toISOString()} />
                        <input type="hidden" name="endDate" value={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()} />
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
