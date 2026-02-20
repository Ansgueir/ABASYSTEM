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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { updateOfficeMember } from "@/actions/users"

interface EditOfficeMemberDialogProps {
    member: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditOfficeMemberDialog({ member, open, onOpenChange }: EditOfficeMemberDialogProps) {
    const [isPending, startTransition] = useTransition()

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        const fullName = formData.get("fullName") as string
        const officeRole = formData.get("officeRole") as string

        startTransition(async () => {
            const result = await updateOfficeMember(member.id, { fullName, officeRole })
            if (result?.error) {
                toast.error(result.error)
            } else {
                toast.success("Office member updated successfully")
                onOpenChange(false)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Office Member</DialogTitle>
                    <DialogDescription>
                        Update name and administrative role.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input id="fullName" name="fullName" defaultValue={member.fullName} required />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="officeRole">Role</Label>
                        <Select name="officeRole" defaultValue={member.officeRole || "ADMIN"}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ADMIN">Admin</SelectItem>
                                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                            </SelectContent>
                        </Select>
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
