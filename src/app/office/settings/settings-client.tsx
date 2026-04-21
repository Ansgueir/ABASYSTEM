"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2, DollarSign, Clock, Bell, Shield, Save, Loader2, Download, Table as TableIcon } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
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
        invoiceDay: "1",
        emailNotificationsEnabled: settings?.emailNotificationsEnabled ?? true
    })
    const [exportOpen, setExportOpen] = useState(false)
    const [startPeriod, setStartPeriod] = useState("1")
    const [endPeriod, setEndPeriod] = useState("48")

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
            data.append("maxHours", formData.maxHours)
            data.append("restrictedAlert", formData.restrictedAlert)
            data.append("emailNotificationsEnabled", formData.emailNotificationsEnabled.toString())
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
                        <Button 
                            variant={formData.emailNotificationsEnabled ? "default" : "outline"} 
                            size="sm" 
                            className="rounded-xl w-24"
                            onClick={() => setFormData(prev => ({ ...prev, emailNotificationsEnabled: !prev.emailNotificationsEnabled }))}
                        >
                            {formData.emailNotificationsEnabled ? "Enabled" : "Disabled"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Master Export Section */}
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <TableIcon className="h-5 w-5" />
                        Master Report Download
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Download the complete foundation database to an Excel (.xlsx) file, including all students, financial periods, dynamic calculations, payments, and system options.
                    </p>

                    <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                        <DialogTrigger asChild>
                            <Button variant="default" className="w-full sm:w-auto mt-2">
                                <Download className="h-4 w-4 mr-2" />
                                Download Master Report
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Configure Export Details</DialogTitle>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Start Period</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={startPeriod}
                                            onChange={(e) => setStartPeriod(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Period</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={endPeriod}
                                            onChange={(e) => setEndPeriod(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Select the range of payment periods (e.g., 1 to 48) you want to include in the &quot;Base Datos&quot; calculations.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
                                <Button asChild onClick={() => setExportOpen(false)}>
                                    <a href={`/api/office/export-master?startPeriod=${startPeriod}&endPeriod=${endPeriod}&t=${Date.now()}`}>
                                        <Download className="h-4 w-4 mr-2" />
                                        Generate & Download
                                    </a>
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
