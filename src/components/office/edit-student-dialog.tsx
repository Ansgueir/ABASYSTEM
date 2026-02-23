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
import { Edit, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateStudent } from "@/actions/users"

interface EditStudentDialogProps {
    student: any
    isSuperAdmin?: boolean
}

export function EditStudentDialog({ student, isSuperAdmin }: EditStudentDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const data = Object.fromEntries(formData.entries())

        // Convert numbers and dates
        const formattedData: any = {
            fullName: data.fullName,
            phone: data.phone,
            bacbId: data.bacbId,
            credential: data.credential,
            level: data.level,
            city: data.city,
            state: data.state,
            startDate: data.startDate ? new Date(data.startDate as string) : null,
            hoursPerMonth: Number(data.hoursPerMonth) || 130,
            supervisionPercentage: Number(data.supervisionPercentage) || 5,
            hourlyRate: Number(data.hourlyRate) || 0,
        }

        startTransition(async () => {
            const result = await updateStudent(student.id, formattedData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Student updated successfully")
                setOpen(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Edit className="h-4 w-4" />
                    Edit Profile
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Student Profile</DialogTitle>
                    <DialogDescription>
                        Modify student information and BACB details.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" defaultValue={student.fullName} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" name="phone" defaultValue={student.phone || ""} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" name="city" defaultValue={student.city || ""} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" name="state" defaultValue={student.state || ""} />
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
                                defaultValue={student.startDate ? new Date(student.startDate).toISOString().split('T')[0] : ""}
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

                    <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="hoursPerMonth">Max Hours/Month</Label>
                            <Input id="hoursPerMonth" name="hoursPerMonth" type="number" defaultValue={Number(student.hoursPerMonth)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="supervisionPercentage">Min % Supervised</Label>
                            <Input id="supervisionPercentage" name="supervisionPercentage" type="number" defaultValue={Number(student.supervisionPercentage)} />
                        </div>
                    </div>

                    {isSuperAdmin && (
                        <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                                <Input id="hourlyRate" name="hourlyRate" type="number" step="0.01" defaultValue={Number(student.hourlyRate || 0)} />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
