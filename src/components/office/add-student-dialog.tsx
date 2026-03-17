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
import { Plus, Loader2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createStudent } from "@/actions/users"

interface AddStudentDialogProps {
    isSuperAdmin?: boolean
}

export function AddStudentDialog({ isSuperAdmin }: AddStudentDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Using client-side form submission to handle transition and toast
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
            <DialogContent className="sm:max-w-[600px] gap-6">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="h-2 w-10 bg-primary/20 rounded-full" />
                        <DialogTitle className="text-2xl font-bold">Add New Student</DialogTitle>
                    </div>
                    <DialogDescription className="text-base">
                        Create a new student profile. They will receive an email with login instructions.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-primary/10">
                        {/* Section: Personal Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Full Name</Label>
                                <Input id="fullName" name="fullName" placeholder="Full legal name" required className="h-10 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Email Address</Label>
                                <Input id="email" name="email" type="email" placeholder="email@example.com" required className="h-10 rounded-lg" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="vcsSequence" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">VCS Sequence</Label>
                                <Input id="vcsSequence" name="vcsSequence" className="h-10 rounded-lg" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedOptionPlan" className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Option Plan</Label>
                                <select id="assignedOptionPlan" name="assignedOptionPlan" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="">Select a plan...</option>
                                    <option value="A">Plan A</option>
                                    <option value="B">Plan B</option>
                                    <option value="C">Plan C</option>
                                    <option value="D">Plan D</option>
                                    <option value="E">Plan E</option>
                                </select>
                            </div>
                        </div>

                        {/* Section: Financials */}
                        <div className="p-4 bg-muted/30 rounded-xl space-y-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Financial Calibration</p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="totalAmountContract" className="text-xs font-semibold">Total Contract ($)</Label>
                                    <Input id="totalAmountContract" name="totalAmountContract" type="number" step="0.01" placeholder="0.00" className="h-9" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="analystPaymentRate" className="text-xs font-semibold">Analyst Rate (%)</Label>
                                    <Input id="analystPaymentRate" name="analystPaymentRate" type="number" step="0.01" placeholder="0.60" className="h-9" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="officePaymentRate" className="text-xs font-semibold">Office Rate (%)</Label>
                                    <Input id="officePaymentRate" name="officePaymentRate" type="number" step="0.01" placeholder="0.40" className="h-9" />
                                </div>
                            </div>
                        </div>

                        {/* Section: Targets */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="regularHoursTarget" className="text-[11px] font-semibold text-muted-foreground">Reg. Target</Label>
                                <Input id="regularHoursTarget" name="regularHoursTarget" type="number" placeholder="0" className="h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="concentratedHoursTarget" className="text-[11px] font-semibold text-muted-foreground">Conc. Target</Label>
                                <Input id="concentratedHoursTarget" name="concentratedHoursTarget" type="number" placeholder="0" className="h-9" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="independentHoursTarget" className="text-[11px] font-semibold text-muted-foreground">Indp. Target</Label>
                                <Input id="independentHoursTarget" name="independentHoursTarget" type="number" placeholder="0" className="h-9" />
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
