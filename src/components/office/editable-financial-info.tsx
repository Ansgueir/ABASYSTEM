"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Edit2, Save, X, Loader2, Landmark, CreditCard, Hash } from "lucide-react"
import { updateSupervisor } from "@/actions/users"
import { useSession } from "next-auth/react"

export function EditableSupervisorFinancialInfo({ supervisor }: { supervisor: any }) {
    const [mounted, setMounted] = useState(false)
    const { data: session } = useSession()

    const [isEditing, setIsEditing] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [companyName, setCompanyName] = useState(supervisor.companyName || "")
    const [taxId, setTaxId] = useState(supervisor.taxId || "")
    const [bankName, setBankName] = useState(supervisor.bankName || "")
    const [routingNumber, setRoutingNumber] = useState(supervisor.routingNumber || "")
    const [accountNumber, setAccountNumber] = useState(supervisor.accountNumber || "")

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) return null

    const sessionRole = String((session?.user as any)?.role || "").toUpperCase()
    const canEdit = sessionRole === "OFFICE" || sessionRole === "QA"

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateSupervisor(supervisor.id, {
                companyName,
                taxId,
                bankName,
                routingNumber,
                accountNumber
            })
            if (res.error) {
                toast.error(res.error)
            } else {
                toast.success("Financial information updated successfully")
                setIsEditing(false)
            }
        })
    }

    const handleCancel = () => {
        setCompanyName(supervisor.companyName || "")
        setTaxId(supervisor.taxId || "")
        setBankName(supervisor.bankName || "")
        setRoutingNumber(supervisor.routingNumber || "")
        setAccountNumber(supervisor.accountNumber || "")
        setIsEditing(false)
    }

    return (
        <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm border-primary/10">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    Financial & Banking Information
                </h3>
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

            <div className="grid gap-4 text-sm mt-4">
                {/* Company Name */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5 font-medium">Company Name</p>
                        {isEditing ? (
                            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Legal business name" className="w-full h-9 mt-1" />
                        ) : (
                            <p className="font-medium text-foreground">{companyName || "N/A"}</p>
                        )}
                    </div>
                </div>

                {/* Tax ID / EIN */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5 font-medium">Tax ID / EIN</p>
                        {isEditing ? (
                            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Employer Identification Number" className="w-full h-9 mt-1 font-mono" />
                        ) : (
                            <p className="font-medium font-mono text-foreground">{taxId || "N/A"}</p>
                        )}
                    </div>
                </div>

                {/* Bank Name */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5 font-medium">Bank Name</p>
                        {isEditing ? (
                            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className="w-full h-9 mt-1" />
                        ) : (
                            <p className="font-medium text-foreground">{bankName || "N/A"}</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Routing Number */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5 font-medium">Routing Number</p>
                            {isEditing ? (
                                <Input value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} placeholder="9-digit code" className="w-full h-9 mt-1 font-mono" />
                            ) : (
                                <p className="font-medium font-mono text-foreground">{routingNumber || "N/A"}</p>
                            )}
                        </div>
                    </div>

                    {/* Account Number */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground mb-0.5 font-medium">Account Number</p>
                            {isEditing ? (
                                <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Full account number" className="w-full h-9 mt-1 font-mono" />
                            ) : (
                                <p className="font-medium font-mono text-foreground">
                                    {accountNumber ? `••••${accountNumber.slice(-4)}` : "N/A"}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
