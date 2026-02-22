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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { MoreHorizontal, Power, RotateCcw, Trash2, Edit, ExternalLink } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { toggleUserStatus, resetUserPassword, deleteStudent, deleteSupervisor, deleteOfficeMember } from "@/actions/users"
import Link from "next/link"
import { EditSupervisorDialog } from "./edit-supervisor-dialog"
import { EditOfficeMemberDialog } from "./edit-office-member-dialog"
import { ManageStudentsDialog } from "./manage-students-dialog"
import { Users } from "lucide-react"

interface UserActionsProps {
    id: string
    userId: string
    name: string
    email: string
    type: "student" | "supervisor" | "office"
    isActive: boolean
    fullData?: any
    isSuperAdmin?: boolean
}

export function UserActions({ id, userId, name, email, type, isActive, fullData, isSuperAdmin = false }: UserActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [showResetDialog, setShowResetDialog] = useState(false)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [showManageStudentsDialog, setShowManageStudentsDialog] = useState(false)
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)

    const handleToggleStatus = () => {
        setIsPopoverOpen(false)
        startTransition(async () => {
            const result = await toggleUserStatus(userId, isActive, type === "office" ? "OFFICE" : "USER")
            if (result.error) toast.error(result.error)
            else toast.success(isActive ? "User disabled" : "User enabled")
        })
    }

    const handleResetPassword = () => {
        startTransition(async () => {
            const result = await resetUserPassword(userId, email, name)
            if (result.error) toast.error(result.error)
            else {
                toast.success("Password reset and email sent")
                setShowResetDialog(false)
            }
        })
    }

    const handleDelete = () => {
        startTransition(async () => {
            let result
            if (type === "student") result = await deleteStudent(id)
            else if (type === "supervisor") result = await deleteSupervisor(id)
            else result = await deleteOfficeMember(id)

            if (result.error) toast.error(result.error)
            else {
                toast.success(`${type} deleted`)
                setShowDeleteDialog(false)
            }
        })
    }

    return (
        <>
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[200px] p-2 space-y-1">
                    <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Actions</p>

                    {type === "student" ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="w-full justify-start h-8 px-2"
                        >
                            <Link href={`/office/students/${id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Details
                            </Link>
                        </Button>
                    ) : (
                        isSuperAdmin && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start h-8 px-2"
                                onClick={() => {
                                    setIsPopoverOpen(false)
                                    setShowEditDialog(true)
                                }}
                            >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Details
                            </Button>
                        )
                    )}

                    {type === "supervisor" && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start h-8 px-2"
                            onClick={() => {
                                setIsPopoverOpen(false)
                                setShowManageStudentsDialog(true)
                            }}
                        >
                            <Users className="mr-2 h-4 w-4" />
                            Manage Students
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={handleToggleStatus}
                    >
                        <Power className={`mr-2 h-4 w-4 ${isActive ? "text-destructive" : "text-green-500"}`} />
                        {isActive ? "Disable Access" : "Enable Access"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={() => {
                            setIsPopoverOpen(false)
                            setShowResetDialog(true)
                        }}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Password
                    </Button>
                    <div className="h-px bg-muted my-1" />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => {
                            setIsPopoverOpen(false)
                            setShowDeleteDialog(true)
                        }}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete {type}
                    </Button>
                </PopoverContent>
            </Popover>

            {/* Edit Dialogs */}
            {type === "supervisor" && fullData && (
                <>
                    <EditSupervisorDialog
                        supervisor={fullData}
                        open={showEditDialog}
                        onOpenChange={setShowEditDialog}
                    />
                    <ManageStudentsDialog
                        supervisorId={id}
                        supervisorName={name}
                        open={showManageStudentsDialog}
                        onOpenChange={setShowManageStudentsDialog}
                    />
                </>
            )}
            {type === "office" && fullData && (
                <EditOfficeMemberDialog
                    member={fullData}
                    open={showEditDialog}
                    onOpenChange={setShowEditDialog}
                />
            )}

            {/* Delete Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Are you sure?</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <strong>{name}</strong>. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isPending}
                        >
                            {isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset Password Dialog */}
            <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reset Password?</DialogTitle>
                        <DialogDescription>
                            This will generate a new random password for <strong>{name}</strong> and email it to them.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowResetDialog(false)}>Cancel</Button>
                        <Button
                            variant="default"
                            onClick={handleResetPassword}
                            disabled={isPending}
                        >
                            {isPending ? "Resetting..." : "Confirm Reset"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
