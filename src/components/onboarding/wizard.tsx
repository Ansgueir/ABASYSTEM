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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { AddressAutocomplete } from "@/components/shared/address-autocomplete"
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
    const [city, setCity] = useState("")
    const [stateLocation, setStateLocation] = useState("")

    // Student specific
    const [bacbId, setBacbId] = useState("")
    const [credential, setCredential] = useState("")
    const [vcsSequence, setVcsSequence] = useState("")

    // Supervisor specific
    const [certificantNumber, setCertificantNumber] = useState("")
    const [qualificationLevel, setQualificationLevel] = useState("")
    const [dateQualified, setDateQualified] = useState("")
    const [examDate, setExamDate] = useState("")

    // Step 2 State
    const [termsAccepted, setTermsAccepted] = useState(false)

    // Step 3 State
    const [sigPad, setSigPad] = useState<SignaturePad | null>(null)
    const [initialsPad, setInitialsPad] = useState<SignaturePad | null>(null)
    const [companyName, setCompanyName] = useState("ABA Supervision System")

    useEffect(() => {
        getGeneralSettings().then((res: any) => {
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
        formData.append("city", city)
        formData.append("state", stateLocation)
        formData.append("bacbId", bacbId)
        formData.append("credential", credential)
        formData.append("vcsSequence", vcsSequence)
        formData.append("certificantNumber", certificantNumber)
        formData.append("qualificationLevel", qualificationLevel)
        formData.append("dateQualified", dateQualified)
        formData.append("examDate", examDate)

        try {
            const result = await submitContactInfo(null, formData)
            if (result.error) {
                toast.error(result.error)
            } else {
                await update({ onboardingStep: 2 }) // Update session
                toast.success("Profile updated")
                setStep(2)
            }
        } catch (err: any) {
            if (err?.message?.includes('NEXT_REDIRECT')) throw err;
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
        } catch (err: any) {
            if (err?.message?.includes('NEXT_REDIRECT')) throw err;
            toast.error("An error occurred")
        } finally {
            setIsPending(false)
        }
    }

    async function handleNextStep3() {
        console.log("[WIZARD] Finalizing Step 3 - Sending Signatures...");
        
        if (!sigPad || sigPad.isEmpty()) {
            toast.error("Please sign the document")
            return
        }
        if (!initialsPad || initialsPad.isEmpty()) {
            toast.error("Please provide your initials")
            return
        }

        setIsPending(true)
        
        try {
            const sigData = sigPad.toDataURL() // base64 png
            const initData = initialsPad.toDataURL()
            
            console.log("[WIZARD] Calling submitSignatures Server Action...");
            const result = await submitSignatures(sigData, initData)
            
            if (result && result.error) {
                console.error("[WIZARD] Server Action Error:", result.error);
                toast.error(result.error)
                setIsPending(false)
            } else if (result && result.success) {
                console.log("[WIZARD] Signatures saved successfully. Updating session...");
                
                // Important to wait for session update
                try {
                    await update({ onboardingCompleted: true })
                    console.log("[WIZARD] Session updated. Redirecting...");
                    
                    toast.success("Onboarding Complete!")

                    // Determine dashboard path based on role
                    const role = initialData.role?.toUpperCase() || "STUDENT"
                    let dashboardPath = "/student"
                    if (role === "SUPERVISOR" || role === "QA") dashboardPath = "/supervisor"
                    else if (role === "OFFICE") dashboardPath = "/office"

                    // Use push directly or window.location if router.push fails
                    router.push(dashboardPath)
                } catch (sessionError) {
                    console.error("[WIZARD] Session update crash:", sessionError);
                    // Fallback redirect even if session update crashes
                    window.location.href = "/" 
                }
            } else {
                 throw new Error("Invalid response from server action");
            }
        } catch (err: any) {
            if (err?.message?.includes('NEXT_REDIRECT')) throw err;
            console.error("[WIZARD] Fatal crash in handleNextStep3:", err);
            toast.error("An error occurred during final step. Please refresh and check your dashboard.")
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
                            <AddressAutocomplete
                                initialStreet={address}
                                initialCity={city}
                                initialState={stateLocation}
                                onAddressChange={(fields) => {
                                    setAddress(fields.street)
                                    setCity(fields.city)
                                    setStateLocation(fields.state)
                                }}
                            />

                            {/* CONDITIONAL RENDER BY ROLE */}
                            {initialData.role.toUpperCase() === "STUDENT" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 border-t pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="bacbId">BACB ID # <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="bacbId"
                                            value={bacbId}
                                            onChange={(e) => setBacbId(e.target.value)}
                                            placeholder="BACB ID"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="credential">Credential <span className="text-red-500">*</span></Label>
                                        <Select onValueChange={setCredential} value={credential} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select credential" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="RBT">RBT</SelectItem>
                                                <SelectItem value="BCaBA">BCaBA</SelectItem>
                                                <SelectItem value="BCBA">BCBA</SelectItem>
                                                <SelectItem value="NO_CREDENTIAL">NO CREDENTIAL (STUDENT)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="vcsSequence">VCS Sequence <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="vcsSequence"
                                            value={vcsSequence}
                                            onChange={(e) => setVcsSequence(e.target.value)}
                                            placeholder="VCS"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {initialData.role.toUpperCase() === "SUPERVISOR" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 border-t pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="certificantNumber">Certification Number (Cert #) <span className="text-red-500">*</span></Label>
                                        <Input
                                            id="certificantNumber"
                                            value={certificantNumber}
                                            onChange={(e) => setCertificantNumber(e.target.value)}
                                            placeholder="Cert #"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="qualificationLevel">Qualification Level <span className="text-red-500">*</span></Label>
                                        <Select onValueChange={setQualificationLevel} value={qualificationLevel} required>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select level" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="BCBA">BCBA</SelectItem>
                                                <SelectItem value="BCBA_D">BCBA-D</SelectItem>
                                                <SelectItem value="BCaBA">BCaBA</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="dateQualified">Date Qualified <span className="text-red-500">*</span></Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <div className="relative cursor-pointer group">
                                                    <Input
                                                        id="dateQualified-display"
                                                        value={dateQualified ? format(new Date(dateQualified), "PPP") : ""}
                                                        placeholder="dd/mm/aaaa"
                                                        readOnly
                                                        className="pr-10 rounded-xl cursor-pointer focus:ring-indigo-500/30 focus:border-indigo-500"
                                                    />
                                                    <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 opacity-70 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={dateQualified ? new Date(dateQualified) : undefined}
                                                    onSelect={(date) => setDateQualified(date ? date.toISOString().split('T')[0] : "")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <input type="hidden" name="dateQualified" value={dateQualified} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="examDate">Exam Date <span className="text-red-500">*</span></Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <div className="relative cursor-pointer group">
                                                    <Input
                                                        id="examDate-display"
                                                        value={examDate ? format(new Date(examDate), "PPP") : ""}
                                                        placeholder="dd/mm/aaaa"
                                                        readOnly
                                                        className="pr-10 rounded-xl cursor-pointer focus:ring-indigo-500/30 focus:border-indigo-500"
                                                    />
                                                    <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-indigo-600 opacity-70 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={examDate ? new Date(examDate) : undefined}
                                                    onSelect={(date) => setExamDate(date ? date.toISOString().split('T')[0] : "")}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <input type="hidden" name="examDate" value={examDate} required />
                                    </div>
                                </div>
                            )}
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
