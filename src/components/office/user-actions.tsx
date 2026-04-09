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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoreHorizontal, Power, RotateCcw, Trash2, Edit, ExternalLink, Mail, KeyRound } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { resetUserPassword, deleteStudent, deleteSupervisor, deleteOfficeMember, toggleStudentStatus, toggleSupervisorStatus, toggleOfficeMemberStatus } from "@/actions/users"
import { adminResetUserPassword } from "@/actions/security"
import Link from "next/link"
import { EditSupervisorDialog } from "./edit-supervisor-dialog"
import { EditStudentDialog } from "./edit-student-dialog"
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
    isQaSuper?: boolean   // ← EXCLUSIVE: only qa-super@abasystem.com gets this true
}

export function UserActions({ id, userId, name, email, type, isActive, fullData, isSuperAdmin = false, isQaSuper = false }: UserActionsProps) {
    const [isPending, startTransition] = useTransition()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [showResetDialog, setShowResetDialog] = useState(false)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [showManageStudentsDialog, setShowManageStudentsDialog] = useState(false)
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)

    // qa-super manual password state
    const [resetMode, setResetMode] = useState<"email" | "manual">("email")
    const [manualPassword, setManualPassword] = useState("")

    const handleToggleStatus = () => {
        setIsPopoverOpen(false)
        startTransition(async () => {
            let result
            if (type === "student") result = await toggleStudentStatus(id, isActive)
            else if (type === "supervisor") result = await toggleSupervisorStatus(id, isActive)
            else result = await toggleOfficeMemberStatus(id, isActive)

            if (result?.error) toast.error(result.error)
            else toast.success(isActive ? "Account disabled" : "Account enabled")
        })
    }

    const handleResetPassword = () => {
        startTransition(async () => {
            let result

            if (isQaSuper && resetMode === "manual") {
                if (!manualPassword || manualPassword.length < 6) {
                    toast.error("Password must be at least 6 characters")
                    return
                }
                result = await adminResetUserPassword(userId, manualPassword)
            } else {
                result = await resetUserPassword(userId, email, name)
            }

            if (result.error) toast.error(result.error)
            else {
                toast.success(
                    resetMode === "manual"
                        ? "Password set successfully"
                        : "Password reset and email sent"
                )
                setShowResetDialog(false)
                setManualPassword("")
                setResetMode("email")
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

                    {type === "supervisor" && (
                        <>
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
                                Manage Student
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="w-full justify-start h-8 px-2"
                            >
                                <Link href={`/office/supervisors/${id}?tab=groups`} onClick={() => setIsPopoverOpen(false)}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Manage Group
                                </Link>
                            </Button>
                        </>
                    )}

                    {isSuperAdmin && (
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
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={handleToggleStatus}
                    >
                        <Power className={`mr-2 h-4 w-4 ${isActive ? "text-destructive" : "text-green-500"}`} />
                        {isActive ? "Disable Account" : "Enable Account"}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 px-2"
                        onClick={() => {
                            setIsPopoverOpen(false)
                            setResetMode("email")
                            setManualPassword("")
                            setShowResetDialog(true)
                        }}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset Account
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
                        Delete Account
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
                        isSuperAdmin={isSuperAdmin}
                    />
                    <ManageStudentsDialog
                        supervisorId={id}
                        supervisorName={name}
                        open={showManageStudentsDialog}
                        onOpenChange={setShowManageStudentsDialog}
                    />
                </>
            )}
            {type === "student" && fullData && (
                <EditStudentDialog
                    student={fullData}
                    open={showEditDialog}
                    onOpenChange={setShowEditDialog}
                    isSuperAdmin={isSuperAdmin}
                />
            )}
            {type === "office" && (
                <EditOfficeMemberDialog
                    member={fullData ? { ...fullData, email } : { userId, isUserId: true, fullName: name, officeRole: "ADMIN", email }}
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
            <Dialog open={showResetDialog} onOpenChange={(open) => {
                setShowResetDialog(open)
                if (!open) { setManualPassword(""); setResetMode("email") }
            }}>
                <DialogContent className="sm:max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Reset the password for <strong>{name}</strong> ({email})
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2 space-y-4">
                        {/* qa-super exclusive: mode toggle */}
                        {isQaSuper && (
                            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setResetMode("email")}
                                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm font-semibold transition-all ${
                                        resetMode === "email"
                                            ? "bg-white shadow text-indigo-600"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Mail className="h-4 w-4" />
                                    Send via Email
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setResetMode("manual")}
                                    className={`flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm font-semibold transition-all ${
                                        resetMode === "manual"
                                            ? "bg-white shadow text-indigo-600"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <KeyRound className="h-4 w-4" />
                                    Set Manually
                                </button>
                            </div>
                        )}

                        {/* Email mode description */}
                        {resetMode === "email" && (
                            <p className="text-sm text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                                A new temporary password will be generated and sent to <strong>{email}</strong>. The user will be required to change it upon next login.
                            </p>
                        )}

                        {/* Manual mode — ONLY for qa-super */}
                        {isQaSuper && resetMode === "manual" && (
                            <div className="space-y-2">
                                <Label htmlFor="manual-pass">New Password</Label>
                                <Input
                                    id="manual-pass"
                                    type="text"
                                    placeholder="Enter the password to assign"
                                    value={manualPassword}
                                    onChange={e => setManualPassword(e.target.value)}
                                    autoComplete="off"
                                    className="font-mono"
                                />
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    ⚠️ The user will be prompted to change this password on next login.
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setShowResetDialog(false); setManualPassword(""); setResetMode("email") }}>
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleResetPassword}
                            disabled={isPending || (isQaSuper && resetMode === "manual" && !manualPassword)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {isPending
                                ? "Processing..."
                                : resetMode === "manual"
                                    ? "Set Password"
                                    : "Send Temporary Password"
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
