"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Edit2, Save, X, Loader2, Mail, Phone, MapPin, Award, Calendar, Clock, DollarSign, GraduationCap, Users, Percent } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateStudent, updateSupervisor } from "@/actions/users"
import { useSession } from "next-auth/react"
import { AddressAutocomplete } from "@/components/shared/address-autocomplete"

/* ───────────────────────────────────────────
   STUDENT – Contact Information (Card 1)
   ─────────────────────────────────────────── */
export function EditableStudentContactInfo({ student, isSuperAdmin: isSuperAdminProp }: { student: any; isSuperAdmin?: boolean }) {
    const [mounted, setMounted] = useState(false)
    const { data: session } = useSession()

    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [fullName, setFullName] = useState(student.fullName || "")
    const [email, setEmail] = useState(student.email || "")
    const [phone, setPhone] = useState(student.phone || "")
    const [city, setCity] = useState(student.city || "")
    const [state, setState] = useState(student.state || "")
    const [address, setAddress] = useState(student.address || "")

    useEffect(() => {
        setMounted(true)
        if (session?.user) {
            console.log("[EditableContactInfo] User session detected:", {
                email: session.user.email,
                role: (session.user as any).role,
                officeRole: (session.user as any).officeRole
            })
        }
    }, [session])

    if (!mounted) return null

    const sessionRole = String((session?.user as any)?.role || "").toUpperCase()
    const sessionOfficeRole = (session?.user as any)?.officeRole
    const userEmail = session?.user?.email

    // Force Super Admin for the specific user and robust check for others
    const isSuperAdmin = (userEmail?.toLowerCase() === "qa-super@abasystem.com") || 
                        isSuperAdminProp || 
                        sessionOfficeRole === "SUPER_ADMIN" || 
                        sessionRole === "QA"

    const canEdit = sessionRole === "OFFICE" || 
                    sessionRole === "QA" || 
                    sessionOfficeRole === "SUPER_ADMIN" || 
                    userEmail?.toLowerCase() === "qa-super@abasystem.com"

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateStudent(student.id, {
                fullName, email, phone, city, state, address
            })
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Contact info updated successfully")
                setIsEditing(false)
            }
        })
    }

    const handleCancel = () => {
        setFullName(student.fullName || "")
        setEmail(student.email || "")
        setPhone(student.phone || "")
        setCity(student.city || "")
        setState(student.state || "")
        setAddress(student.address || "")
        setIsEditing(false)
    }

    return (
        <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Contact Information</h3>
                {!isEditing ? (
                    canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </Button>
                    )
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-3 text-sm mt-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Edit2 className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                        {isEditing ? (
                            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{fullName}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                            {isEditing && isSuperAdmin && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 uppercase">
                                    Editable
                                </span>
                            )}
                        </div>
                        {isEditing && isSuperAdmin ? (
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full h-8 mt-1 border-amber-200 focus-visible:ring-amber-500" />
                        ) : (
                            <p className="font-medium">{email}</p>
                        )}
                        {isEditing && !isSuperAdmin && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">Email can only be changed by Super Admins</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                        {isEditing ? (
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{phone || "—"}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-primary/70 shrink-0 mt-1" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                        {isEditing ? (
                            <div className="mt-1">
                                <AddressAutocomplete
                                    initialStreet={address}
                                    initialCity={city}
                                    initialState={state}
                                    onAddressChange={(fields) => {
                                        setAddress(fields.street)
                                        setCity(fields.city)
                                        setState(fields.state)
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="font-medium">{[address, city, state].filter(Boolean).join(", ") || "—"}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────
   STUDENT – BACB & Fieldwork Info (Card 2)
   Includes fields from old EditStudentDialog:
   bacbId, startDate, credential, level,
   hoursPerMonth, supervisionPercentage, hourlyRate
   ───────────────────────────────────────────────── */
export function EditableStudentBacbFieldwork({ student, isSuperAdmin: isSuperAdminProp }: { student: any; isSuperAdmin?: boolean }) {
    const [mounted, setMounted] = useState(false)
    const { data: session } = useSession()

    useEffect(() => {
        setMounted(true)
    }, [])

    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [bacbId, setBacbId] = useState(student.bacbId || "")
    const [credential, setCredential] = useState(student.credential || "RBT")
    const [level, setLevel] = useState(student.level || "BCBA")
    const [fieldworkType, setFieldworkType] = useState(student.fieldworkType || "REGULAR")
    const [startDate, setStartDate] = useState(() => {
        if (!student.startDate) return ""
        const d = new Date(student.startDate)
        return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : ""
    })
    const [hoursPerMonth, setHoursPerMonth] = useState(String(Number(student.hoursPerMonth) || 130))
    const [supervisionPercentage, setSupervisionPercentage] = useState(String(Number(student.supervisionPercentage) || 5))
    const [hourlyRate, setHourlyRate] = useState(String(Number(student.hourlyRate || 0).toFixed(2)))
    const [vcsSequence, setVcsSequence] = useState(student.vcsSequence || "")
    const [assignedOptionPlan, setAssignedOptionPlan] = useState(student.assignedOptionPlan || "")
    const [totalAmountContract, setTotalAmountContract] = useState(String(Number(student.totalAmountContract || 0)))
    const [analystPaymentRate, setAnalystPaymentRate] = useState(String(Number(student.analystPaymentRate || 0)))
    const [officePaymentRate, setOfficePaymentRate] = useState(String(Number(student.officePaymentRate || 0)))
    const [internalComments, setInternalComments] = useState(student.internalComments || "")
    const [hoursTargetReg, setHoursTargetReg] = useState(String(Number(student.hoursTargetReg || 0)))
    const [hoursTargetConc, setHoursTargetConc] = useState(String(Number(student.hoursTargetConc || 0)))
    const [independentHoursTarget, setIndependentHoursTarget] = useState(String(Number(student.independentHoursTarget || 0)))

    if (!mounted) return null

    const sessionRole = String((session?.user as any)?.role || "").toUpperCase()
    const sessionOfficeRole = (session?.user as any)?.officeRole
    const userEmail = session?.user?.email

    const isSuperAdmin = (userEmail?.toLowerCase() === "qa-super@abasystem.com") || 
                        isSuperAdminProp || 
                        sessionOfficeRole === "SUPER_ADMIN" || 
                        sessionRole === "QA"

    const canEdit = sessionRole === "OFFICE" || sessionRole === "QA" || userEmail?.toLowerCase() === "qa-super@abasystem.com"

    const handleSave = () => {
        startTransition(async () => {
            const dataToUpdate: any = {
                bacbId,
                credential,
                level,
                fieldworkType,
                hoursPerMonth: parseInt(hoursPerMonth) || 130,
                supervisionPercentage: parseFloat(supervisionPercentage) || 5,
                vcsSequence: vcsSequence || null,
                assignedOptionPlan: assignedOptionPlan || null,
                totalAmountContract: parseFloat(totalAmountContract) || null,
                analystPaymentRate: parseFloat(analystPaymentRate) || null,
                officePaymentRate: parseFloat(officePaymentRate) || null,
                hoursTargetReg: parseInt(hoursTargetReg) || 0,
                hoursTargetConc: parseInt(hoursTargetConc) || 0,
                independentHoursTarget: parseInt(independentHoursTarget) || null,
                internalComments: internalComments || null
            }
            if (startDate) dataToUpdate.startDate = new Date(startDate)
            if (isSuperAdmin) {
                dataToUpdate.hourlyRate = parseFloat(hourlyRate) || 0
            }

            const res = await updateStudent(student.id, dataToUpdate)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("BACB & fieldwork info updated successfully")
                setIsEditing(false)
            }
        })
    }

    const handleCancel = () => {
        setBacbId(student.bacbId || "")
        setCredential(student.credential || "RBT")
        setLevel(student.level || "BCBA")
        setFieldworkType(student.fieldworkType || "REGULAR")
        setStartDate(() => {
            if (!student.startDate) return ""
            const d = new Date(student.startDate)
            return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : ""
        })
        setHoursPerMonth(String(Number(student.hoursPerMonth) || 130))
        setSupervisionPercentage(String(Number(student.supervisionPercentage) || 5))
        setHourlyRate(String(Number(student.hourlyRate || 0).toFixed(2)))
        setVcsSequence(student.vcsSequence || "")
        setAssignedOptionPlan(student.assignedOptionPlan || "")
        setTotalAmountContract(String(Number(student.totalAmountContract || 0)))
        setAnalystPaymentRate(String(Number(student.analystPaymentRate || 0)))
        setOfficePaymentRate(String(Number(student.officePaymentRate || 0)))
        setInternalComments(student.internalComments || "")
        setHoursTargetReg(String(Number(student.hoursTargetReg || 0)))
        setHoursTargetConc(String(Number(student.hoursTargetConc || 0)))
        setIndependentHoursTarget(String(Number(student.independentHoursTarget || 0)))
        setIsEditing(false)
    }

    return (
        <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">BACB & Fieldwork Info</h3>
                {!isEditing ? (
                    canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </Button>
                    )
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-3 text-sm mt-4">
                {/* BACB ID */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Award className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">BACB ID #</p>
                        {isEditing ? (
                            <Input value={bacbId} onChange={(e) => setBacbId(e.target.value)} placeholder="Enter BACB ID..." className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-mono font-bold text-lg">{bacbId || "—"}</p>
                        )}
                    </div>
                </div>

                {/* Credential + Goal Level */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <GraduationCap className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Credential</p>
                            {isEditing ? (
                                <Select value={credential} onValueChange={setCredential}>
                                    <SelectTrigger className="w-full h-8 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RBT">RBT</SelectItem>
                                        <SelectItem value="BCaBA">BCaBA</SelectItem>
                                        <SelectItem value="Trainee">Trainee</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="font-semibold uppercase text-primary">{credential}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <GraduationCap className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Goal Level</p>
                            {isEditing ? (
                                <Select value={level} onValueChange={setLevel}>
                                    <SelectTrigger className="w-full h-8 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BCBA">BCBA</SelectItem>
                                        <SelectItem value="BCaBA">BCaBA</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="font-semibold uppercase text-primary">{level}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Additional Foundation Fields */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Award className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">VCS Sequence</p>
                        {isEditing ? (
                            <Input value={vcsSequence} onChange={(e) => setVcsSequence(e.target.value)} placeholder="VCS Sequence" className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-semibold text-primary">{vcsSequence || "—"}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <GraduationCap className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Option Plan</p>
                        {isEditing ? (
                            <Select value={assignedOptionPlan} onValueChange={setAssignedOptionPlan}>
                                <SelectTrigger className="w-full sm:w-[220px] h-8 mt-1"><SelectValue placeholder="Plan (A-E)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="A">Plan A</SelectItem>
                                    <SelectItem value="B">Plan B</SelectItem>
                                    <SelectItem value="C">Plan C</SelectItem>
                                    <SelectItem value="D">Plan D</SelectItem>
                                    <SelectItem value="E">Plan E</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="font-semibold text-primary">{assignedOptionPlan || "—"}</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Reg. Hours Target</p>
                            {isEditing ? (
                                <Input type="number" value={hoursTargetReg} onChange={(e) => setHoursTargetReg(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold">{hoursTargetReg}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Conc. Hours Target</p>
                            {isEditing ? (
                                <Input type="number" value={hoursTargetConc} onChange={(e) => setHoursTargetConc(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold">{hoursTargetConc}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Ind. Hours Target</p>
                            {isEditing ? (
                                <Input type="number" value={independentHoursTarget} onChange={(e) => setIndependentHoursTarget(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold">{independentHoursTarget}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <DollarSign className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Analyst Rate (%)</p>
                            {isEditing ? (
                                <Input type="number" step="0.0001" value={analystPaymentRate} onChange={(e) => setAnalystPaymentRate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold">{analystPaymentRate}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <DollarSign className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Office Rate (%)</p>
                            {isEditing ? (
                                <Input type="number" step="0.0001" value={officePaymentRate} onChange={(e) => setOfficePaymentRate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold">{officePaymentRate}</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Total Amount Contract ($)</p>
                        {isEditing ? (
                            <Input type="number" step="0.01" value={totalAmountContract} onChange={(e) => setTotalAmountContract(e.target.value)} className="w-full sm:w-[220px] h-8 mt-1" />
                        ) : (
                            <p className="font-bold">${totalAmountContract}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Internal Comments</p>
                        {isEditing ? (
                            <Input value={internalComments} onChange={(e) => setInternalComments(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium text-muted-foreground">{internalComments || "—"}</p>
                        )}
                    </div>
                </div>

                {/* Fieldwork Type */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Award className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Fieldwork Type (PDF Checkbox)</p>
                        {isEditing ? (
                            <Select value={fieldworkType} onValueChange={setFieldworkType}>
                                <SelectTrigger className="w-full sm:w-[220px] h-8 mt-1"><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="REGULAR">Supervised (Regular)</SelectItem>
                                    <SelectItem value="CONCENTRATED">Concentrated</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <p className="font-semibold uppercase text-primary">
                                {fieldworkType === "CONCENTRATED" ? "Concentrated" : "Supervised (Regular)"}
                            </p>
                        )}
                    </div>
                </div>

                {/* Start Date */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Calendar className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Start Date</p>
                        {isEditing ? (
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-[200px] h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{startDate ? new Date(startDate).toLocaleDateString() : "—"}</p>
                        )}
                    </div>
                </div>

                {/* Hours/Month + Min % Supervised */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <Clock className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Max Hours/Month</p>
                            {isEditing ? (
                                <Input type="number" value={hoursPerMonth} onChange={(e) => setHoursPerMonth(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold text-lg">{hoursPerMonth}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <Percent className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Min % Supervised</p>
                            {isEditing ? (
                                <Input type="number" value={supervisionPercentage} onChange={(e) => setSupervisionPercentage(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold text-lg">{supervisionPercentage}%</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hourly Rate – Super Admin only */}
                {isSuperAdmin && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <DollarSign className="h-5 w-5 text-amber-600 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-amber-700 dark:text-amber-400 mb-0.5 font-semibold">Hourly Rate (Super Admin)</p>
                            {isEditing ? (
                                <Input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="w-full sm:w-[160px] h-8 mt-1" />
                            ) : (
                                <p className="font-bold text-lg">${hourlyRate}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────
   SUPERVISOR – Contact & Certification (Card 1)
   Includes ALL fields from old EditSupervisorDialog:
   fullName, phone, address, bacbId, certificantNumber,
   credentialType, maxStudents, paymentPercentage,
   + examDate, training8hrDate from previous tab
   ───────────────────────────────────────────────── */
export function EditableSupervisorContactInfo({ supervisor, isSuperAdmin: isSuperAdminProp }: { supervisor: any; isSuperAdmin?: boolean }) {
    const [mounted, setMounted] = useState(false)
    const { data: session } = useSession()

    useEffect(() => {
        setMounted(true)
    }, [])

    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [fullName, setFullName] = useState(supervisor.fullName || "")
    const [email, setEmail] = useState(supervisor.email || "")
    const [phone, setPhone] = useState(supervisor.phone || "")
    const [address, setAddress] = useState(supervisor.address || "")
    const [bacbId, setBacbId] = useState(supervisor.bacbId || "")
    const [certificantNumber, setCertificantNumber] = useState(supervisor.certificantNumber || "")
    const [credentialType, setCredentialType] = useState(supervisor.credentialType || "BCBA")
    const [maxStudents, setMaxStudents] = useState(String(Number(supervisor.maxStudents) || 10))
    const [paymentPercentage, setPaymentPercentage] = useState(String(Number(supervisor.paymentPercentage) || 0.60))
    const [examDate, setExamDate] = useState(supervisor.examDate ? new Date(supervisor.examDate).toISOString().split('T')[0] : "")
    const [training8hrDate, setTraining8hrDate] = useState(supervisor.training8hrDate ? new Date(supervisor.training8hrDate).toISOString().split('T')[0] : "")
    const [internalIdNumber, setInternalIdNumber] = useState(supervisor.internalIdNumber || "")
    const [dateQualified, setDateQualified] = useState(supervisor.dateQualified ? new Date(supervisor.dateQualified).toISOString().split('T')[0] : "")

    if (!mounted) return null

    const sessionRole = String((session?.user as any)?.role || "").toUpperCase()
    const sessionOfficeRole = (session?.user as any)?.officeRole
    const userEmail = session?.user?.email

    const isSuperAdmin = (userEmail?.toLowerCase() === "qa-super@abasystem.com") || 
                        isSuperAdminProp || 
                        sessionOfficeRole === "SUPER_ADMIN" || 
                        sessionRole === "QA"

    const canEdit = sessionRole === "OFFICE" || 
                    sessionRole === "QA" || 
                    sessionOfficeRole === "SUPER_ADMIN" || 
                    userEmail?.toLowerCase() === "qa-super@abasystem.com"

    const handleSave = () => {
        startTransition(async () => {
            const dataToUpdate: any = {
                fullName, email, phone, address, bacbId, certificantNumber, credentialType,
                maxStudents: Number(maxStudents) || 10,
                paymentPercentage: Number(paymentPercentage) || 0.60,
                internalIdNumber: internalIdNumber || null,
            }
            if (examDate) dataToUpdate.examDate = new Date(examDate)
            if (training8hrDate) dataToUpdate.training8hrDate = new Date(training8hrDate)
            if (dateQualified) dataToUpdate.dateQualified = new Date(dateQualified)

            const res = await updateSupervisor(supervisor.id, dataToUpdate)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervisor info updated successfully")
                setIsEditing(false)
            }
        })
    }

    const handleCancel = () => {
        setFullName(supervisor.fullName || "")
        setEmail(supervisor.email || "")
        setPhone(supervisor.phone || "")
        setAddress(supervisor.address || "")
        setBacbId(supervisor.bacbId || "")
        setCertificantNumber(supervisor.certificantNumber || "")
        setCredentialType(supervisor.credentialType || "BCBA")
        setMaxStudents(String(Number(supervisor.maxStudents) || 10))
        setPaymentPercentage(String(Number(supervisor.paymentPercentage) || 0.60))
        setExamDate(supervisor.examDate ? new Date(supervisor.examDate).toISOString().split('T')[0] : "")
        setTraining8hrDate(supervisor.training8hrDate ? new Date(supervisor.training8hrDate).toISOString().split('T')[0] : "")
        setInternalIdNumber(supervisor.internalIdNumber || "")
        setDateQualified(supervisor.dateQualified ? new Date(supervisor.dateQualified).toISOString().split('T')[0] : "")
        setIsEditing(false)
    }

    return (
        <div className="rounded-xl border bg-card p-6 space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Contact & Certification</h3>
                {!isEditing ? (
                    canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                        </Button>
                    )
                ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCancel} disabled={isPending}>
                            <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Save
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-3 text-sm mt-4">
                {/* Full Name */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Edit2 className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Full Name</p>
                        {isEditing ? (
                            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{fullName}</p>
                        )}
                    </div>
                </div>

                {/* Email (read-only) */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                            {isEditing && isSuperAdmin && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 uppercase">
                                    Editable
                                </span>
                            )}
                        </div>
                        {isEditing && isSuperAdmin ? (
                            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full h-8 mt-1 border-amber-200 focus-visible:ring-amber-500" />
                        ) : (
                            <p className="font-medium">{email}</p>
                        )}
                        {isEditing && !isSuperAdmin && (
                            <p className="text-[10px] text-muted-foreground mt-1 italic">Email can only be changed by Super Admins</p>
                        )}
                    </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                        {isEditing ? (
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{phone || "—"}</p>
                        )}
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-primary/70 shrink-0 mt-1" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                        {isEditing ? (
                            <div className="mt-1">
                                <AddressAutocomplete
                                    initialStreet={address}
                                    onAddressChange={(fields) => {
                                        setAddress(fields.street)
                                    }}
                                />
                            </div>
                        ) : (
                            <p className="font-medium">{address || "—"}</p>
                        )}
                    </div>
                </div>

                {/* BACB ID + Certificant # & Internal ID */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Award className="h-5 w-5 text-primary/70 shrink-0" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">BACB / Cert # / Internal ID</p>
                        {isEditing ? (
                            <div className="flex gap-2 mt-1">
                                <Input value={bacbId} onChange={(e) => setBacbId(e.target.value)} placeholder="BACB ID" className="w-1/3 h-8" />
                                <Input value={certificantNumber} onChange={(e) => setCertificantNumber(e.target.value)} placeholder="Cert #" className="w-1/3 h-8" />
                                <Input value={internalIdNumber} onChange={(e) => setInternalIdNumber(e.target.value)} placeholder="Int ID" className="w-1/3 h-8" />
                            </div>
                        ) : (
                            <p className="font-medium">BACB: {bacbId || "PENDING"} • Cert: {certificantNumber || "PENDING"} • Int: {internalIdNumber || "—"}</p>
                        )}
                    </div>
                </div>

                {/* Credential Type + Max Students + Payment % */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <GraduationCap className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Type</p>
                            {isEditing ? (
                                <Select value={credentialType} onValueChange={setCredentialType}>
                                    <SelectTrigger className="w-full h-8 mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BCBA">BCBA</SelectItem>
                                        <SelectItem value="BCaBA">BCaBA</SelectItem>
                                        <SelectItem value="BCBA-D">BCBA-D</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="font-semibold uppercase text-primary">{credentialType}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <Users className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Max Students</p>
                            {isEditing ? (
                                <Input type="number" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold text-lg">{maxStudents}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                        <Percent className="h-5 w-5 text-primary/70 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Pay %</p>
                            {isEditing ? (
                                <Input type="number" step="0.01" value={paymentPercentage} onChange={(e) => setPaymentPercentage(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-bold text-lg">{(Number(paymentPercentage) * 100).toFixed(0)}%</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Exam Date + 8Hr Training + Date Qualified */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Exam Date</p>
                            {isEditing ? (
                                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-medium text-xs">{examDate ? new Date(examDate).toLocaleDateString() : "—"}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">8Hr Training</p>
                            {isEditing ? (
                                <Input type="date" value={training8hrDate} onChange={(e) => setTraining8hrDate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-medium text-xs">{training8hrDate ? new Date(training8hrDate).toLocaleDateString() : "—"}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Date Qualified</p>
                            {isEditing ? (
                                <Input type="date" value={dateQualified} onChange={(e) => setDateQualified(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-medium text-xs">{dateQualified ? new Date(dateQualified).toLocaleDateString() : "—"}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
