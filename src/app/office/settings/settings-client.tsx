"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, DollarSign, Clock, Bell, Shield, Save, Loader2 } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateGeneralSettings } from "@/actions/settings"

interface SettingsClientProps {
    settings: any
}

export function SettingsClient({ settings }: SettingsClientProps) {
    const [isPending, startTransition] = useTransition()
    const [formData, setFormData] = useState({
        companyName: settings?.companyName || "ABA Supervision System",
        companyEmail: settings?.companyEmail || "office@abasystem.com",
        companyPhone: settings?.companyPhone || "(555) 123-4567",
        companyAddress: settings?.companyAddress || "123 Main St",
        bcbaRate: settings?.supervisorPaymentPercentage ? (settings.supervisorPaymentPercentage * 100).toString() : "54",
        maxHours: settings?.maxHoursPerMonth?.toString() || "130",
        restrictedAlert: settings?.restrictedAlertPercent?.toString() || "40",
        bcabaRate: "60",
        invoiceDay: "1"
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setFormData(prev => ({ ...prev, [id]: value }))
    }

    const handleSave = () => {
        startTransition(async () => {
            const data = new FormData()
            data.append("companyName", formData.companyName)
            data.append("companyEmail", formData.companyEmail)
            data.append("companyPhone", formData.companyPhone)
            data.append("companyAddress", formData.companyAddress)
            data.append("bcbaRate", formData.bcbaRate)
            // Add other fields when supported by backend or schema DB changes

            const result = await updateGeneralSettings(data)

            if (result.success) {
                toast.success("Settings saved successfully!")
            } else {
                toast.error(result.error || "Failed to update settings")
            }
        })
    }

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-muted-foreground">Configure global system settings and preferences</p>
            </div>

            {/* Global Identity Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Global Entity Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="companyName">Platform / Company Name</Label>
                            <Input
                                id="companyName"
                                value={formData.companyName}
                                onChange={handleChange}
                                placeholder="ABA Supervision System"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyEmail">Contact Email</Label>
                            <Input
                                id="companyEmail"
                                type="email"
                                value={formData.companyEmail}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyPhone">Phone Number</Label>
                            <Input
                                id="companyPhone"
                                value={formData.companyPhone}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyAddress">Physical Address</Label>
                            <Input
                                id="companyAddress"
                                value={formData.companyAddress}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Hours Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Hours Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="maxHours">Max Hours per Month</Label>
                            <Input
                                id="maxHours"
                                type="number"
                                value={formData.maxHours}
                                onChange={handleChange}
                                placeholder="130"
                            />
                            <p className="text-xs text-muted-foreground">Current limit: 130h (160h from 2027)</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="restrictedAlert">Restricted Hours Alert (%)</Label>
                            <Input
                                id="restrictedAlert"
                                type="number"
                                value={formData.restrictedAlert}
                                onChange={handleChange}
                                placeholder="40"
                            />
                            <p className="text-xs text-muted-foreground">Alert if restricted hours exceed this</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Payment Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Payment Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="bcbaRate">BCBA Commission Rate (%)</Label>
                            <Input
                                id="bcbaRate"
                                type="number"
                                value={formData.bcbaRate}
                                onChange={handleChange}
                                placeholder="54"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bcabaRate">BCaBA Commission Rate (%)</Label>
                            <Input
                                id="bcabaRate"
                                type="number"
                                value={formData.bcabaRate}
                                onChange={handleChange}
                                placeholder="60"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="invoiceDay">Invoice Generation Day</Label>
                            <Input
                                id="invoiceDay"
                                type="number"
                                value={formData.invoiceDay}
                                onChange={handleChange}
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">Invoices auto-generated on day 1</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Notification Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                        <div>
                            <p className="font-medium">Email Notifications</p>
                            <p className="text-sm text-muted-foreground">Send invoice and payment reminders</p>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl">
                            Enabled
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                        <div>
                            <p className="font-medium">Hours Limit Alerts</p>
                            <p className="text-sm text-muted-foreground">Alert when approaching monthly limits</p>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl">
                            Enabled
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button variant="gradient" className="rounded-xl" onClick={handleSave} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Settings
                </Button>
            </div>
        </div>
    )
}
