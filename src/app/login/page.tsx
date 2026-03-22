"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Briefcase, Building2, Loader2, Mail, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react"
import { PasswordInput } from "@/components/ui/password-input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { requestPasswordReset } from "@/actions/security"

export default function LoginPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [role, setRole] = useState<"student" | "supervisor" | "office">("student")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    // Forgot password modal state
    const [forgotOpen, setForgotOpen] = useState(false)
    const [forgotEmail, setForgotEmail] = useState("")
    const [forgotLoading, setForgotLoading] = useState(false)
    const [forgotSent, setForgotSent] = useState(false)
    const [forgotError, setForgotError] = useState("")

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError("")

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email,
                password,
            })

            if (result?.error) {
                setError("Invalid credentials")
            } else {
                if (role === "student") router.push("/student")
                else if (role === "supervisor") router.push("/supervisor")
                else if (role === "office") router.push("/office")
            }
        } catch (err) {
            setError("An unexpected error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setForgotLoading(true)
        setForgotError("")

        const result = await requestPasswordReset(forgotEmail)

        setForgotLoading(false)
        if (result.error) {
            setForgotError(result.error)
        } else {
            setForgotSent(true)
        }
    }

    const handleForgotClose = () => {
        setForgotOpen(false)
        // Reset state after close animation
        setTimeout(() => {
            setForgotEmail("")
            setForgotError("")
            setForgotSent(false)
        }, 300)
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            {/* Decorative background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
                <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
            </div>

            <Card className="relative w-full max-w-md shadow-elevated animate-fade-in">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-4">
                        <div className="rounded-2xl gradient-primary p-4 shadow-medium">
                            <GraduationCap className="h-10 w-10 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">ABA Supervisor System</CardTitle>
                    <CardDescription>
                        Enter your credentials to access your portal
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-2 mb-6">
                        <Button
                            variant={role === "student" ? "default" : "outline"}
                            className={`flex flex-col h-20 items-center justify-center space-y-2 rounded-xl transition-all ${role === "student"
                                ? "gradient-primary text-white shadow-medium"
                                : "bg-background border-border hover:bg-secondary"
                                }`}
                            onClick={() => setRole("student")}
                            type="button"
                        >
                            <GraduationCap className="h-6 w-6" />
                            <span className="text-xs font-medium">Student</span>
                        </Button>
                        <Button
                            variant={role === "supervisor" ? "default" : "outline"}
                            className={`flex flex-col h-20 items-center justify-center space-y-2 rounded-xl transition-all ${role === "supervisor"
                                ? "bg-warning text-warning-foreground shadow-medium"
                                : "bg-background border-border hover:bg-secondary"
                                }`}
                            onClick={() => setRole("supervisor")}
                            type="button"
                        >
                            <Briefcase className="h-6 w-6" />
                            <span className="text-xs font-medium">Supervisor</span>
                        </Button>
                        <Button
                            variant={role === "office" ? "default" : "outline"}
                            className={`flex flex-col h-20 items-center justify-center space-y-2 rounded-xl transition-all ${role === "office"
                                ? "bg-success text-success-foreground shadow-medium"
                                : "bg-background border-border hover:bg-secondary"
                                }`}
                            onClick={() => setRole("office")}
                            type="button"
                        >
                            <Building2 className="h-6 w-6" />
                            <span className="text-xs font-medium">Office</span>
                        </Button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <button
                                    type="button"
                                    onClick={() => setForgotOpen(true)}
                                    className="text-xs text-primary hover:underline focus:outline-none transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                            <PasswordInput
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            variant="gradient"
                            className="w-full text-white"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                "Sign In"
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                        ABA Supervisor System
                    </p>
                </CardFooter>
            </Card>

            {/* ─── Forgot Password Dialog ─────────────────────────────────── */}
            <Dialog open={forgotOpen} onOpenChange={handleForgotClose}>
                <DialogContent className="sm:max-w-[540px]">
                    <DialogHeader>
                        <div className="flex justify-center mb-3">
                            <div className={`p-3 rounded-xl ${forgotSent ? 'bg-green-100' : 'bg-indigo-100'}`}>
                                {forgotSent
                                    ? <CheckCircle2 className="h-7 w-7 text-green-600" />
                                    : <KeyRound className="h-7 w-7 text-indigo-600" />
                                }
                            </div>
                        </div>
                        <DialogTitle className="text-center">
                            {forgotSent ? "Check your email" : "Reset your password"}
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            {forgotSent
                                ? "If an account exists for that email, a temporary password has been sent. Use it to sign in — you'll be asked to set a new one immediately."
                                : "Enter the email associated with your account. We'll send you a temporary password to access the system."
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {!forgotSent ? (
                        <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="forgot-email">Email address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        id="forgot-email"
                                        type="email"
                                        placeholder="name@example.com"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        className="pl-9"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {forgotError && (
                                <div className="text-destructive text-sm bg-destructive/10 p-3 rounded-xl border border-destructive/20 text-center">
                                    {forgotError}
                                </div>
                            )}

                            <DialogFooter className="flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleForgotClose}
                                    className="w-full sm:w-auto"
                                >
                                    <ArrowLeft className="h-4 w-4 mr-1" />
                                    Back to Sign In
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={forgotLoading || !forgotEmail}
                                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    {forgotLoading ? (
                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                                    ) : (
                                        "Send Temporary Password"
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    ) : (
                        <DialogFooter className="pt-2">
                            <Button
                                onClick={handleForgotClose}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                            >
                                Back to Sign In
                            </Button>
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
