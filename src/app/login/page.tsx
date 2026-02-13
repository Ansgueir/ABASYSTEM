"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { GraduationCap, Briefcase, Building2, Loader2 } from "lucide-react"

export default function LoginPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [role, setRole] = useState<"student" | "supervisor" | "office">("student")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

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
                    <CardTitle className="text-2xl font-bold tracking-tight">
                        ABA Supervision System
                    </CardTitle>
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
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
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
                        ABA Supervision System
                    </p>
                </CardFooter>
            </Card>
        </div>
    )
}
