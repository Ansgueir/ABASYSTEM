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
import { updateSupervisor } from "@/actions/users"

interface EditSupervisorDialogProps {
    supervisor: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditSupervisorDialog({ supervisor, open, onOpenChange }: EditSupervisorDialogProps) {
    const [isPending, startTransition] = useTransition()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const data = Object.fromEntries(formData.entries())

        const formattedData: any = {
            fullName: data.fullName,
            phone: data.phone,
            address: data.address,
            bacbId: data.bacbId,
            certificantNumber: data.certificantNumber,
            credentialType: data.credentialType,
            maxStudents: Number(data.maxStudents) || 10,
            paymentPercentage: Number(data.paymentPercentage) || 0.60,
        }

        startTransition(async () => {
            const result = await updateSupervisor(supervisor.id, formattedData)
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Supervisor updated successfully")
                onOpenChange(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Edit Supervisor Profile</DialogTitle>
                    <DialogDescription>
                        Modify supervisor contact information and credentials.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name</Label>
                            <Input id="fullName" name="fullName" defaultValue={supervisor.fullName} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" name="phone" defaultValue={supervisor.phone || ""} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" name="address" defaultValue={supervisor.address || ""} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="bacbId">BACB ID</Label>
                            <Input id="bacbId" name="bacbId" defaultValue={supervisor.bacbId} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="certificantNumber">Certificant #</Label>
                            <Input id="certificantNumber" name="certificantNumber" defaultValue={supervisor.certificantNumber || ""} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="credentialType">Type</Label>
                            <Select name="credentialType" defaultValue={supervisor.credentialType || "BCBA"}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BCBA">BCBA</SelectItem>
                                    <SelectItem value="BCaBA">BCaBA</SelectItem>
                                    <SelectItem value="BCBA-D">BCBA-D</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="maxStudents">Max Students</Label>
                            <Input id="maxStudents" name="maxStudents" type="number" defaultValue={supervisor.maxStudents} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="paymentPercentage">Pay % (0.60)</Label>
                            <Input id="paymentPercentage" name="paymentPercentage" type="number" step="0.01" defaultValue={Number(supervisor.paymentPercentage)} />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
