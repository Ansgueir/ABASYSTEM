"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitContactInfo, submitTerms, submitSignatures } from "@/actions/onboarding"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useSession } from "next-auth/react"
import { useEffect } from "react"
import { getGeneralSettings } from "@/actions/settings"

import type SignaturePad from "react-signature-canvas"

// Dynamically import SignatureCanvas to avoid SSR issues with window/canvas
// Cast to any to avoid "Property 'ref' does not exist" TS error with dynamic import
const SignatureCanvas = dynamic(() => import("react-signature-canvas"), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-gray-100 animate-pulse rounded-md" />
}) as any

interface WizardProps {
    initialStep: number
    initialData: {
        phone: string
        address: string
        fullName: string
        email: string
        role: string,
        step: number
    }
}

export default function OnboardingWizard({ initialStep, initialData }: WizardProps) {
    const [step, setStep] = useState(initialStep || 1)
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()
    const { update } = useSession()

    // Step 1 State
    const [phone, setPhone] = useState(initialData.phone || "")
    const [address, setAddress] = useState(initialData.address || "")

    // Step 2 State
    const [termsAccepted, setTermsAccepted] = useState(false)

    // Step 3 State
    const [sigPad, setSigPad] = useState<SignaturePad | null>(null)
    const [initialsPad, setInitialsPad] = useState<SignaturePad | null>(null)
    const [companyName, setCompanyName] = useState("ABA Supervision System")

    useEffect(() => {
        getGeneralSettings().then(res => {
            if (res.success && res.settings) {
                setCompanyName(res.settings.companyName)
            }
        })
    }, [])

    async function handleNextStep1(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        const formData = new FormData()
        formData.append("phone", phone)
        formData.append("address", address)

        try {
            const result = await submitContactInfo(null, formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                await update({ onboardingStep: 2 }) // Update session
                toast.success("Profile updated")
                setStep(2)
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsPending(false)
        }
    }

    async function handleNextStep2(e: React.FormEvent) {
        e.preventDefault()
        setIsPending(true)
        const formData = new FormData()
        if (termsAccepted) formData.append("accepted", "on")

        try {
            const result = await submitTerms(null, formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                await update({ onboardingStep: 3 }) // Update session
                toast.success("Terms accepted")
                setStep(3)
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsPending(false)
        }
    }

    async function handleNextStep3() {
        if (!sigPad || sigPad.isEmpty()) {
            toast.error("Please sign the document")
            return
        }
        if (!initialsPad || initialsPad.isEmpty()) {
            toast.error("Please provide your initials")
            return
        }

        setIsPending(true)
        const sigData = sigPad.toDataURL() // base64 png
        const initData = initialsPad.toDataURL()

        try {
            const result = await submitSignatures(sigData, initData)
            if (result.error) {
                toast.error(result.error)
            } else {
                await update({ onboardingCompleted: true }) // CRITICAL: Update session before redirect
                toast.success("Onboarding Complete!")

                // Determine dashboard path based on role
                const rolePath = initialData.role?.toLowerCase() || "student"
                const dashboardPath = `/${rolePath}`

                // Small delay to ensure cookie is set
                setTimeout(() => {
                    router.push(dashboardPath)
                }, 500)
            }
        } catch (err) {
            toast.error("An error occurred")
        } finally {
            setIsPending(false)
        }
    }

    const clearSignature = () => sigPad?.clear()
    const clearInitials = () => initialsPad?.clear()

    return (
        <Card className="w-full shadow-lg border-t-4 border-indigo-600">
            <CardHeader>
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-gray-500">Step {step} of 3</span>
                    <Progress value={(step / 3) * 100} className="w-1/2" />
                </div>
                <CardTitle>
                    {step === 1 && "Profile Completion"}
                    {step === 2 && "Terms & Conditions"}
                    {step === 3 && "Digital Signature"}
                </CardTitle>
                <CardDescription>
                    {step === 1 && "Start by verifying your contact information."}
                    {step === 2 && "Please review and accept our policies."}
                    {step === 3 && "Finally, register your signature for future documents."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {step === 1 && (
                    <form onSubmit={handleNextStep1} id="step1-form" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label>Full Name (Read Only)</Label>
                                <Input value={initialData.fullName} disabled className="bg-gray-100" />
                            </div>
                            <div>
                                <Label>Email (Read Only)</Label>
                                <Input value={initialData.email} disabled className="bg-gray-100" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="+1 (555) 000-0000"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Full Address <span className="text-red-500">*</span></Label>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="123 Main St, City, State, Zip"
                                    required
                                />
                            </div>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleNextStep2} id="step2-form" className="space-y-6">
                        <div className="bg-gray-50 p-4 rounded-md border text-sm text-gray-700 h-64 overflow-y-auto">
                            <h4 className="font-bold mb-2">Terms of Use & Data Transparency Policy</h4>
                            <p className="mb-2">
                                By using the {companyName}, you acknowledge and agree to the following terms regarding data privacy, security, and usage.
                            </p>
                            <p className="mb-2">
                                <strong>1. Data Collection:</strong> We collect personal information (name, email, phone, address) and professional data (certifications, hours logged) solely for the purpose of supervision tracking and compliance with BACB standards.
                            </p>
                            <p className="mb-2">
                                <strong>2. Use of Signatures:</strong> Your digital signature and initials captured in this system will be used to automatically sign monthly verification forms and contracts generated within the platform. You authorize the system to apply your signature to documents you approve.
                            </p>
                            <p className="mb-2">
                                <strong>3. No Employment Relationship:</strong> This platform is a tool for tracking supervision hours and does not constitute an employment contract between you and the supervision provider, unless explicitly stated in a separate written agreement.
                            </p>
                            <p className="mb-2">
                                <strong>4. Security:</strong> We employ industry-standard security measures to protect your data. However, you are responsible for maintaining the confidentiality of your login credentials.
                            </p>
                            <p>
                                <strong>5. Accuracy:</strong> You certify that all data entered into this system, including fieldwork hours, is accurate and truthful to the best of your knowledge.
                            </p>
                        </div>
                        <div className="flex items-start space-x-2">
                            <Checkbox
                                id="terms"
                                checked={termsAccepted}
                                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="terms" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    I accept the Terms of Use and Data Transparency Policy
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    You must accept to proceed.
                                </p>
                            </div>
                        </div>
                    </form>
                )}

                {step === 3 && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Full Signature</Label>
                                <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">Clear</Button>
                            </div>
                            <div className="border rounded-md bg-white h-40 w-full touch-none">
                                <SignatureCanvas
                                    ref={(ref: SignaturePad | null) => setSigPad(ref)}
                                    canvasProps={{ className: "w-full h-full" }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Sign above using your mouse or finger.</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Initials</Label>
                                <Button variant="ghost" size="sm" onClick={clearInitials} className="text-xs">Clear</Button>
                            </div>
                            <div className="border rounded-md bg-white h-32 w-48 touch-none">
                                <SignatureCanvas
                                    ref={(ref: SignaturePad | null) => setInitialsPad(ref)}
                                    canvasProps={{ className: "w-full h-full" }}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">Draw your initials.</p>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between">
                {step > 1 && step < 3 && (
                    <Button variant="outline" onClick={() => setStep(step - 1)} disabled={isPending}>Back</Button>
                )}
                <div className="flex-1"></div>
                {step === 1 && (
                    <Button form="step1-form" type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Next Step
                    </Button>
                )}
                {step === 2 && (
                    <Button form="step2-form" type="submit" disabled={!termsAccepted || isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Next Step
                    </Button>
                )}
                {step === 3 && (
                    <Button onClick={handleNextStep3} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Complete Setup
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}
