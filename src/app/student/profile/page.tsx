"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Phone, MapPin, GraduationCap, Calendar, Save, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useState, useEffect, useTransition } from "react"
import { toast } from "sonner"
import { updateProfile } from "@/actions/profile"

export default function ProfilePage() {
    const { data: session, update } = useSession()
    const [isPending, startTransition] = useTransition()
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        phone: "",
        address: "",
        academicDegree: "",
        hoursPerMonth: "",
        supervisorName: "",
        startDate: "",
    })

    const role = (session?.user as any)?.role?.toLowerCase() || "student"

    useEffect(() => {
        async function fetchProfile() {
            if (!session?.user?.id) return

            try {
                const response = await fetch(`/api/user/profile?id=${session.user.id}`)
                if (response.ok) {
                    const data = await response.json()
                    setFormData({
                        fullName: data.fullName || "",
                        email: session.user.email || "",
                        phone: data.phone || "",
                        address: data.address || "",
                        academicDegree: data.academicDegree || "Student",
                        hoursPerMonth: data.hoursPerMonth?.toString() || "130",
                        supervisorName: data.supervisor?.fullName || "Not assigned",
                        startDate: data.contractStartDate ? new Date(data.contractStartDate).toLocaleDateString() : "N/A",
                    })

                    // Proactively refresh session name if it's currently 'User'
                    if (session?.user && (session.user.name === "User" || !session.user.name) && data.fullName) {
                        update({ name: data.fullName })
                    }
                }
            } catch (error) {
                console.error("Error fetching profile:", error)
            }
        }
        fetchProfile()
    }, [session])

    const initials = formData.fullName
        ? formData.fullName.split(' ').map(n => n[0]).join('').toUpperCase()
        : 'US'

    async function handleSave() {
        startTransition(async () => {
            const data = new FormData()
            data.append("phone", formData.phone)
            data.append("address", formData.address)

            const result = await updateProfile(data)
            if (result.success) {
                await update({ name: formData.fullName })
                toast.success("Profile updated successfully")
            } else {
                toast.error(result.error || "Failed to update profile")
            }
        })
    }

    return (
        <DashboardLayout role={role as any}>
            <div className="space-y-6 max-w-3xl">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold">Profile</h1>
                        <p className="text-muted-foreground">Manage your personal information</p>
                    </div>
                </div>

                {/* Profile Card */}
                <Card className="border-t-4 border-indigo-600">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <Avatar className="h-24 w-24 border-4 border-primary/20 shadow-lg">
                                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center sm:text-left">
                                <h2 className="text-xl font-bold">{formData.fullName || 'Loading...'}</h2>
                                <p className="text-muted-foreground">{formData.email}</p>
                                <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                        {formData.academicDegree}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                            <User className="h-5 w-5" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name (Read Only)</Label>
                                <Input
                                    id="fullName"
                                    value={formData.fullName}
                                    readOnly
                                    className="bg-muted text-muted-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Read Only)</Label>
                                <Input
                                    id="email"
                                    value={formData.email}
                                    readOnly
                                    className="bg-muted text-muted-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="Enter your phone number"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="address">Address <span className="text-red-500">*</span></Label>
                                <Input
                                    id="address"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    placeholder="Enter your address"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Academic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2 text-indigo-700">
                            <GraduationCap className="h-5 w-5" />
                            Academic Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Academic Degree</Label>
                                <Input
                                    value={formData.academicDegree}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Hours Per Month</Label>
                                <Input
                                    value={formData.hoursPerMonth}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Supervisor</Label>
                                <Input
                                    value={formData.supervisorName}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    value={formData.startDate}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="rounded-xl px-8 gradient-primary shadow-lg hover:shadow-indigo-500/30 transition-all font-semibold"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Changes
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    )
}

