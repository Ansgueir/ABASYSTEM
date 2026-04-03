"use client"

import { useState } from "react"
import * as z from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { PasswordInput } from "@/components/ui/password-input"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { changeInitialPassword } from "@/actions/security"
import { useRouter } from "next/navigation"

const passwordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain at least one uppercase letter")
        .regex(/[a-z]/, "Must contain at least one lowercase letter")
        .regex(/[0-9]/, "Must contain at least one number")
        .regex(/[^A-Za-z0-9]/, "Must contain at least one special character")
        .max(100),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

export default function ChangePasswordPage() {
    const { update } = useSession()
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
    const [isPending, setIsPending] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const router = useRouter()

    // Using standard fetch/catch instead of useActionState for simplicity with client-side form libraries
    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsPending(true)
        setError(null)
        setFieldErrors({})

        const formData = new FormData(event.currentTarget)
        const password = formData.get("newPassword") as string
        const confirm = formData.get("confirmPassword") as string

        if (password !== confirm) {
            toast.error("Passwords do not match")
            setIsPending(false)
            return
        }

        try {
            const result = await changeInitialPassword(null, formData)

            if (result.error) {
                setError(result.error)
                if (result.fieldErrors) {
                    setFieldErrors(result.fieldErrors)
                }
                toast.error(result.error)
                setIsPending(false)
            } else if (result.success) {
                toast.success("Password updated successfully!")

                try {
                    // Update session state locally - THIS IS CRITICAL for Middleware to see the change
                    await update({
                        isFirstLogin: false,
                        onboardingStep: 1
                    })
                    
                    // Small delay to ensure cookie is written before navigation
                    setTimeout(() => {
                        window.location.href = "/onboarding"
                    }, 500)
                } catch (updateError) {
                    console.error("Session update failed:", updateError)
                    window.location.href = "/onboarding"
                }
            }
        } catch (error) {
            console.error(error)
            toast.error("Something went wrong")
            setIsPending(false)
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Change Password</CardTitle>
                    <CardDescription className="text-center">
                        For security reasons, you must change your temporary password before accessing your account.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={onSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Current Password</Label>
                            <PasswordInput
                                id="currentPassword"
                                name="currentPassword"
                                required
                                placeholder="Enter the temporary password"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    name="newPassword"
                                    type={showNewPassword ? "text" : "password"}
                                    required
                                    className={fieldErrors.newPassword ? "border-red-500" : ""}
                                    placeholder="Min 8 chars, uppercase, lowercase, number, special char"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {fieldErrors.newPassword && (
                                <p className="text-xs text-red-500 mt-1">{fieldErrors.newPassword[0]}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm New Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    className={fieldErrors.confirmPassword ? "border-red-500" : ""}
                                    placeholder="Re-enter new password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {fieldErrors.confirmPassword && (
                                <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword[0]}</p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full" type="submit" disabled={isPending}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                "Update Password & Continue"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}
