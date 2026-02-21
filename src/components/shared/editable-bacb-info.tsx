"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Edit2, Save, X, Loader2 } from "lucide-react"
import { updateStudentBacbInfo, updateSupervisorBacbId } from "@/actions/bacb-info"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "next-auth/react"

export function EditableStudentBacbInfo({
    studentId,
    initialBacbId,
    initialFieldworkType
}: {
    studentId: string,
    initialBacbId: string,
    initialFieldworkType: string
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [bacbId, setBacbId] = useState(initialBacbId || "")
    const [fieldworkType, setFieldworkType] = useState(initialFieldworkType || "REGULAR")

    const { data: session } = useSession()
    const role = String((session?.user as any)?.role || "").toUpperCase()
    const canEdit = role === "OFFICE" || role === "QA"

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateStudentBacbInfo(studentId, bacbId, fieldworkType)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Student BACB info updated successfully")
                setIsEditing(false)
            }
        })
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
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={isPending}>
                            <X className="h-4 w-4" />
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-4 text-sm mt-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 rounded-lg bg-muted/30 gap-4">
                    <span className="text-muted-foreground font-medium">BACB ID #</span>
                    {isEditing ? (
                        <Input
                            value={bacbId}
                            onChange={(e) => setBacbId(e.target.value)}
                            placeholder="Enter BACB ID..."
                            className="w-full sm:w-auto"
                        />
                    ) : (
                        <span className="font-mono font-bold text-lg">{bacbId || "—"}</span>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between sm:items-center p-3 rounded-lg bg-muted/30 gap-4">
                    <span className="text-muted-foreground font-medium">Fieldwork Type (PDF Checkbox)</span>
                    {isEditing ? (
                        <Select value={fieldworkType} onValueChange={setFieldworkType}>
                            <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="REGULAR">Supervised (Regular)</SelectItem>
                                <SelectItem value="CONCENTRATED">Concentrated</SelectItem>
                            </SelectContent>
                        </Select>
                    ) : (
                        <span className="font-semibold uppercase text-primary">
                            {fieldworkType === "CONCENTRATED" ? "Concentrated" : "Supervised (Regular)"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

export function EditableSupervisorBacbInfo({
    userId,
    initialBacbId,
}: {
    userId: string,
    initialBacbId: string,
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [bacbId, setBacbId] = useState(initialBacbId || "")

    const { data: session } = useSession()
    const role = String((session?.user as any)?.role || "").toUpperCase()
    const canEdit = role === "OFFICE" || role === "QA"

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateSupervisorBacbId(userId, bacbId)
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Supervisor BACB ID updated successfully")
                setIsEditing(false)
            }
        })
    }

    return (
        <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30 gap-4 w-full">
            <div className="flex flex-col gap-1 w-full">
                <span className="text-sm font-medium text-muted-foreground">My BACB ID # / Certificant #</span>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <Input
                            value={bacbId}
                            onChange={(e) => setBacbId(e.target.value)}
                            placeholder="Enter BACB ID..."
                            className="max-w-[200px]"
                        />
                        <Button variant="default" size="icon" onClick={handleSave} disabled={isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setIsEditing(false)} disabled={isPending}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-lg">{bacbId || "MISSING"}</span>
                        {canEdit && (
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                                <Edit2 className="h-4 w-4 mr-2" /> Edit
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
