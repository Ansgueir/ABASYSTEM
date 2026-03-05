"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Edit2, Save, X, Loader2, Mail, Phone, MapPin, Award, Calendar } from "lucide-react"
import { updateStudent, updateSupervisor } from "@/actions/users"
import { useSession } from "next-auth/react"

export function EditableStudentContactInfo({ student }: { student: any }) {
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [fullName, setFullName] = useState(student.fullName || "")
    const [phone, setPhone] = useState(student.phone || "")
    const [city, setCity] = useState(student.city || "")
    const [state, setState] = useState(student.state || "")

    const { data: session } = useSession()
    const role = String((session?.user as any)?.role || "").toUpperCase()
    const canEdit = role === "OFFICE" || role === "QA"

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateStudent(student.id, {
                fullName, phone, city, state
            })
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Contact info updated successfully")
                setIsEditing(false)
            }
        })
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
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isPending}>
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
                    <Edit2 className="h-5 w-5 text-primary/70" />
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
                    <Mail className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                        <p className="font-medium">{student.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                        {isEditing ? (
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{phone}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Location</p>
                        {isEditing ? (
                            <div className="flex gap-2 mt-1">
                                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-1/2 h-8" />
                                <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className="w-1/2 h-8" />
                            </div>
                        ) : (
                            <p className="font-medium">{city}, {state}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function EditableSupervisorContactInfo({ supervisor }: { supervisor: any }) {
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [fullName, setFullName] = useState(supervisor.fullName || "")
    const [phone, setPhone] = useState(supervisor.phone || "")
    const [address, setAddress] = useState(supervisor.address || "")
    const [bacbId, setBacbId] = useState(supervisor.bacbId || "")
    const [certificantNumber, setCertificantNumber] = useState(supervisor.certificantNumber || "")
    const [examDate, setExamDate] = useState(supervisor.examDate ? new Date(supervisor.examDate).toISOString().split('T')[0] : "")
    const [training8hrDate, setTraining8hrDate] = useState(supervisor.training8hrDate ? new Date(supervisor.training8hrDate).toISOString().split('T')[0] : "")

    const { data: session } = useSession()
    const role = String((session?.user as any)?.role || "").toUpperCase()
    const canEdit = role === "OFFICE" || role === "QA"

    const handleSave = () => {
        startTransition(async () => {
            const dataToUpdate: any = {
                fullName, phone, address, bacbId, certificantNumber
            }
            if (examDate) dataToUpdate.examDate = new Date(examDate)
            if (training8hrDate) dataToUpdate.training8hrDate = new Date(training8hrDate)

            const res = await updateSupervisor(supervisor.id, dataToUpdate)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Contact info updated successfully")
                setIsEditing(false)
            }
        })
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
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isPending}>
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
                    <Edit2 className="h-5 w-5 text-primary/70" />
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
                    <Mail className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                        <p className="font-medium">{supervisor.email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                        {isEditing ? (
                            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{phone}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <MapPin className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                        {isEditing ? (
                            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full h-8 mt-1" />
                        ) : (
                            <p className="font-medium">{address}</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Award className="h-5 w-5 text-primary/70" />
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">BACB & Certification ID</p>
                        {isEditing ? (
                            <div className="flex gap-2 mt-1">
                                <Input value={bacbId} onChange={(e) => setBacbId(e.target.value)} placeholder="BACB ID" className="w-1/2 h-8" />
                                <Input value={certificantNumber} onChange={(e) => setCertificantNumber(e.target.value)} placeholder="Cert #" className="w-1/2 h-8" />
                            </div>
                        ) : (
                            <p className="font-medium">BACB: {bacbId || "PENDING"} • Cert: {certificantNumber || "PENDING"}</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <Calendar className="h-5 w-5 text-primary/70" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">Exam Date</p>
                            {isEditing ? (
                                <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-medium text-xs">{examDate ? new Date(examDate).toLocaleDateString() : "-"}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <Calendar className="h-5 w-5 text-primary/70" />
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5">8Hr Training</p>
                            {isEditing ? (
                                <Input type="date" value={training8hrDate} onChange={(e) => setTraining8hrDate(e.target.value)} className="w-full h-8 mt-1" />
                            ) : (
                                <p className="font-medium text-xs">{training8hrDate ? new Date(training8hrDate).toLocaleDateString() : "-"}</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
