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
import { Plus } from "lucide-react"
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Student</DialogTitle>
                    <DialogDescription>
                        Create a new student profile. They will receive an email with login instructions.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit}>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="fullName" className="text-right">
                                Full Name
                            </Label>
                            <Input id="fullName" name="fullName" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input id="email" name="email" type="email" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">
                                Phone
                            </Label>
                            <Input id="phone" name="phone" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="bacbId" className="text-right">BACB ID</Label>
                            <Input id="bacbId" name="bacbId" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="vcsSequence" className="text-right">VCS Sequence</Label>
                            <Input id="vcsSequence" name="vcsSequence" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="assignedOptionPlan" className="text-right">Option Plan</Label>
                            <select id="assignedOptionPlan" name="assignedOptionPlan" className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                                <option value="">Select...</option>
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="totalAmountContract" className="text-right">Total Contract ($)</Label>
                            <Input id="totalAmountContract" name="totalAmountContract" type="number" step="0.01" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="analystPaymentRate" className="text-right">Analyst Rate (%)</Label>
                            <Input id="analystPaymentRate" name="analystPaymentRate" type="number" step="0.0001" placeholder="e.g. 0.60" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="officePaymentRate" className="text-right">Office Rate (%)</Label>
                            <Input id="officePaymentRate" name="officePaymentRate" type="number" step="0.0001" placeholder="e.g. 0.40" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="regularHoursTarget" className="text-right">Reg. Hours Target</Label>
                            <Input id="regularHoursTarget" name="regularHoursTarget" type="number" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="concentratedHoursTarget" className="text-right">Conc. Hours Target</Label>
                            <Input id="concentratedHoursTarget" name="concentratedHoursTarget" type="number" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="independentHoursTarget" className="text-right">Indp. Hours Target</Label>
                            <Input id="independentHoursTarget" name="independentHoursTarget" type="number" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="internalComments" className="text-right">Comments</Label>
                            <Input id="internalComments" name="internalComments" className="col-span-3" />
                        </div>
                        {isSuperAdmin && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="hourlyRate" className="text-right">Hourly Rate ($)</Label>
                                <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" className="col-span-3" required />
                            </div>
                        )}
                        <input type="hidden" name="city" value="Miami" />
                        <input type="hidden" name="state" value="FL" />
                        <input type="hidden" name="school" value="FSU" />
                        <input type="hidden" name="supervisionType" value="REGULAR" />
                        <input type="hidden" name="startDate" value={new Date().toISOString()} />
                        <input type="hidden" name="endDate" value={new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Creating..." : "Create Student"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
