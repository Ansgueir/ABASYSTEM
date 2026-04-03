"use client"

import { useState, useTransition } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { updateStudent } from "@/actions/users"
import { AddressAutocomplete } from "@/components/shared/address-autocomplete"
import { Badge } from "@/components/ui/badge"
import { useEffect } from "react"

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
}

interface EditStudentDialogProps {
    student: any
    open?: boolean
    onOpenChange?: (open: boolean) => void
    isSuperAdmin?: boolean
}

export function EditStudentDialog({ 
    student, 
    open: controlledOpen, 
    onOpenChange: controlledOnOpenChange,
    isSuperAdmin = false 
}: EditStudentDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const onOpenChange = controlledOnOpenChange || setInternalOpen
    const [isPending, startTransition] = useTransition()
    const [plans, setPlans] = useState<Plan[]>([])
    const [loadingPlans, setLoadingPlans] = useState(false)

    // Controlled fields for auto-fill and locking
    const [selectedPlanId, setSelectedPlanId] = useState<string>(student.planTemplateId || "")
    const [vcsSequence, setVcsSequence] = useState(student.assignedOptionPlan || "")
    const [totalAmount, setTotalAmount] = useState(student.totalAmountContract?.toString() || "")
    const [analystRate, setAnalystRate] = useState(((student.analystPaymentRate || 0) * 100).toFixed(2))
    const [officeRate, setOfficeRate] = useState(((student.officePaymentRate || 0) * 100).toFixed(2))
    const [regTarget, setRegTarget] = useState(student.hoursTargetReg?.toString() || "")
    const [concTarget, setConcTarget] = useState(student.hoursTargetConc?.toString() || "")
    const [totalMonths, setTotalMonths] = useState(student.totalMonths?.toString() || "12")
    const [bcabaTarget, setBcabaTarget] = useState(student.independentHoursTarget?.toString() || "0")
    const [fieldworkType, setFieldworkType] = useState(student.fieldworkType || "REGULAR")

    const [addressFields, setAddressFields] = useState({
        street: student.address || "",
        city: student.city || "",
        state: student.state || "",
        zipCode: ""
    })

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
            return // Keep current values but unlock
        }

        const plan = plans.find(p => p.id === val)
        if (plan) {
            setVcsSequence(plan.name)
            setTotalAmount(plan.totalCharge.toString())
            setFieldworkType(plan.fieldworkType || "REGULAR")
            
            const total = Number(plan.totalCharge)
            const payout = Number(plan.analystPayout)
            if (total > 0) {
                const aRate = ((payout / total) * 100).toFixed(2)
                const oRate = (100 - Number(aRate)).toFixed(2)
                setAnalystRate(aRate)
                setOfficeRate(oRate)
            }

            const totalReg = Number(plan.regHoursBcba) + Number(plan.regHoursBcaba)
            setRegTarget(totalReg.toString())
            setConcTarget(plan.concHours.toString())
            setBcabaTarget("0")
            setTotalMonths((plan.totalMonths || 12).toString())
            
            toast.info(`Plan "${plan.name}" applied!`, {
                icon: <Sparkles className="h-4 w-4 text-amber-500" />
            })
        }
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const dataEntries = Object.fromEntries(formData.entries())

        // Ensure locked fields are included and formatted correctly
        const finalAnalystRate = isLocked ? Number(analystRate) / 100 : Number(dataEntries.analystPaymentRate) / 100
        const finalOfficeRate = isLocked ? Number(officeRate) / 100 : Number(dataEntries.officePaymentRate) / 100

        const formattedData: any = {
            fullName: dataEntries.fullName,
            phone: dataEntries.phone,
            address: addressFields.street,
            city: addressFields.city,
            state: addressFields.state,
            bacbId: dataEntries.bacbId,
            credential: dataEntries.credential,
            level: dataEntries.level,
            startDate: dataEntries.startDate ? new Date(dataEntries.startDate as string) : null,
            hoursPerMonth: parseInt(dataEntries.hoursPerMonth as string) || 130,
            supervisionPercentage: parseFloat(dataEntries.supervisionPercentage as string) || 5,
            hourlyRate: parseFloat(dataEntries.hourlyRate as string) || 0,
            email: dataEntries.email,
            // Epic Integration Fields (Snapshotting)
            planTemplateId: selectedPlanId || null,
            assignedOptionPlan: isLocked ? vcsSequence : dataEntries.assignedOptionPlan,
            vcsSequence: vcsSequence,
            totalAmountContract: parseFloat(totalAmount),
            analystPaymentRate: parseFloat(analystRate) / 100,
            officePaymentRate: parseFloat(officeRate) / 100,
            totalMonths: parseInt(totalMonths),
            hoursTargetReg: parseInt(regTarget),
            hoursTargetConc: parseInt(concTarget),
            fieldworkType: fieldworkType,
            independentHoursTarget: Number(dataEntries.independentHoursTarget || 0)
        }

        startTransition(async () => {
            const result = await updateStudent(student.id, formattedData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Student updated successfully")
                onOpenChange(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {controlledOpen === undefined && (
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                        <Edit className="h-4 w-4" />
                        Edit Profile
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Edit Student Profile
                        {isLocked && <Badge variant="secondary" className="bg-primary/10 text-primary">Templates Applied</Badge>}
                    </DialogTitle>
                    <DialogDescription>
                        Modify credentials and VCS sequence targets.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" defaultValue={student.fullName} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input id="email" name="email" type="email" defaultValue={student.email} required disabled={!isSuperAdmin} />
                        </div>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-4">
                        <Label className="text-xs font-bold uppercase text-primary">Plan Template Configuration</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="planTemplateId">Selected Plan</Label>
                                <select 
                                    id="planTemplateId" 
                                    name="planTemplateId" 
                                    value={selectedPlanId}
                                    onChange={handlePlanChange}
                                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">-- Manual Configuration --</option>
                                    <option value="manual">PLAN MANUAL (Unlock Fields)</option>
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedOptionPlan">Active Plan Name</Label>
                                <Input 
                                    id="assignedOptionPlan" 
                                    name="assignedOptionPlan" 
                                    value={vcsSequence} 
                                    onChange={(e) => setVcsSequence(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted font-bold text-primary" : ""}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/40 rounded-xl border space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Hours & Completion Targets</Label>
                            {isLocked && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">LOCKED</Badge>}
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="hoursTargetReg" className="text-[11px]">BCBA REG. TARGET</Label>
                                <Input 
                                    id="hoursTargetReg" 
                                    name="hoursTargetReg" 
                                    type="number" 
                                    value={regTarget}
                                    onChange={(e) => setRegTarget(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="hoursTargetConc" className="text-[11px]">CONC. TARGET</Label>
                                <Input 
                                    id="hoursTargetConc" 
                                    name="hoursTargetConc" 
                                    type="number" 
                                    value={concTarget}
                                    onChange={(e) => setConcTarget(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="independentHoursTarget" className="text-[11px]">BCaBA TARGET</Label>
                                <Input id="independentHoursTarget" name="independentHoursTarget" type="number" value={bcabaTarget} onChange={(e) => setBcabaTarget(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/40 rounded-xl border space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Financial & Contract Calibration</Label>
                            {isLocked && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">LOCKED</Badge>}
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="totalAmountContract" className="text-[11px]">TOTAL ($)</Label>
                                <Input 
                                    id="totalAmountContract" 
                                    name="totalAmountContract" 
                                    type="number" 
                                    value={totalAmount}
                                    onChange={(e) => setTotalAmount(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="analystPaymentRate" className="text-[11px]">ANALYST (%)</Label>
                                <Input 
                                    id="analystPaymentRate" 
                                    name="analystPaymentRate" 
                                    type="number" 
                                    value={analystRate}
                                    onChange={(e) => setAnalystRate(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="officePaymentRate" className="text-[11px]">OFFICE (%)</Label>
                                <Input 
                                    id="officePaymentRate" 
                                    name="officePaymentRate" 
                                    type="number" 
                                    value={officeRate}
                                    onChange={(e) => setOfficeRate(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="totalMonths" className="text-[11px]">MONTHS</Label>
                                <Input 
                                    id="totalMonths" 
                                    name="totalMonths" 
                                    type="number" 
                                    value={totalMonths}
                                    onChange={(e) => setTotalMonths(e.target.value)}
                                    readOnly={isLocked}
                                    className={isLocked ? "bg-muted" : ""}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bacbId">BACB ID</Label>
                            <Input id="bacbId" name="bacbId" defaultValue={student.bacbId} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                                id="startDate"
                                name="startDate"
                                type="date"
                                defaultValue={(() => {
                                    if (!student.startDate) return ""
                                    const d = new Date(student.startDate)
                                    if (isNaN(d.getTime())) return ""
                                    const y = d.getUTCFullYear()
                                    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
                                    const day = String(d.getUTCDate()).padStart(2, '0')
                                    return `${y}-${m}-${day}`
                                })()}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="credential">Credential</Label>
                            <Select name="credential" defaultValue={student.credential || "RBT"}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select credential" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="RBT">RBT</SelectItem>
                                    <SelectItem value="BCaBA">BCaBA</SelectItem>
                                    <SelectItem value="Trainee">Trainee</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="level">Goal Level</Label>
                            <Select name="level" defaultValue={student.level || "BCBA"}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select level" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BCBA">BCBA</SelectItem>
                                    <SelectItem value="BCaBA">BCaBA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fieldworkType">Fieldwork Classification</Label>
                        <Select name="fieldworkType" value={fieldworkType} onValueChange={setFieldworkType} disabled={isLocked}>
                            <SelectTrigger className={isLocked ? "bg-muted cursor-not-allowed" : ""}>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="REGULAR">Regular (Supervised)</SelectItem>
                                <SelectItem value="CONCENTRATED">Concentrated</SelectItem>
                            </SelectContent>
                        </Select>
                        {isLocked && <p className="text-[10px] text-amber-600 font-bold italic">Auto-managed by Plan Template</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="hoursPerMonth">Max Hours/Month</Label>
                            <Input id="hoursPerMonth" name="hoursPerMonth" type="number" defaultValue={Number(student.hoursPerMonth)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supervisionPercentage">Min % Supervised</Label>
                            <Input id="supervisionPercentage" name="supervisionPercentage" type="number" defaultValue={Number(student.supervisionPercentage)} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" defaultValue={student.phone || ""} />
                    </div>

                    <AddressAutocomplete
                        initialStreet={student.address || ""}
                        initialCity={student.city || ""}
                        initialState={student.state || ""}
                        onAddressChange={(fields) => setAddressFields(fields)}
                    />

                    {isSuperAdmin && (
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                                <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" defaultValue={Number(student.hourlyRate || 0).toFixed(2)} />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending} className="px-8">
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Student Profile
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
