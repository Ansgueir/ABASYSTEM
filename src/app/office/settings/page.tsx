import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Settings, DollarSign, Clock, Bell, Shield, Save } from "lucide-react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function OfficeSettingsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    return (
        <DashboardLayout role="office">
            <div className="space-y-6 max-w-3xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-muted-foreground">Configure system settings and preferences</p>
                </div>

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
                                    defaultValue="130"
                                    placeholder="130"
                                />
                                <p className="text-xs text-muted-foreground">Current limit: 130h (160h from 2027)</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="restrictedAlert">Restricted Hours Alert (%)</Label>
                                <Input
                                    id="restrictedAlert"
                                    type="number"
                                    defaultValue="40"
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
                                    defaultValue="54"
                                    placeholder="54"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bcabaRate">BCaBA Commission Rate (%)</Label>
                                <Input
                                    id="bcabaRate"
                                    type="number"
                                    defaultValue="60"
                                    placeholder="60"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="invoiceDay">Invoice Generation Day</Label>
                                <Input
                                    id="invoiceDay"
                                    type="number"
                                    defaultValue="1"
                                    placeholder="1"
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

                {/* Group Session Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Group Session Limits
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="maxStudents">Max Students per Group Session</Label>
                            <Input
                                id="maxStudents"
                                type="number"
                                defaultValue="10"
                                disabled
                                className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">BACB limit: 10 students maximum</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button variant="gradient" className="rounded-xl">
                        <Save className="h-4 w-4 mr-2" />
                        Save Settings
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    )
}
