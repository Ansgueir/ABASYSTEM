import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Mail, Briefcase, Award, Save } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function SupervisorProfilePage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    let supervisor = null

    try {
        supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id },
            include: { _count: { select: { students: true } } }
        })
    } catch (error) {
        console.error("Error fetching profile:", error)
    }

    const initials = supervisor?.fullName
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'SV'

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6 max-w-3xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">Manage your professional information</p>
                </div>

                {/* Profile Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <Avatar className="h-24 w-24 border-4 border-primary/20">
                                <AvatarImage src="/placeholder-user.jpg" />
                                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center sm:text-left">
                                <h2 className="text-xl font-bold">{supervisor?.fullName || 'Supervisor'}</h2>
                                <p className="text-muted-foreground">{session.user.email}</p>
                                <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                                    <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-sm font-medium">
                                        BCBA {/* {supervisor?.credentialType || 'BCBA'} */}
                                    </span>
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                        {supervisor?._count?.students || 0} Students
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Personal Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5" />
                            Personal Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    defaultValue={supervisor?.fullName || ''}
                                    placeholder="Enter your full name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    defaultValue={session.user.email || ''}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Professional Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Award className="h-5 w-5" />
                            Professional Information
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Credential Type</Label>
                                <Input defaultValue={supervisor?.credentialType || 'BCBA'} disabled className="bg-muted" />
                            </div>
                            <div className="space-y-2">
                                <Label>Credential Number</Label>
                                <Input
                                    defaultValue={supervisor?.certificantNumber || ''}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Payment Percentage</Label>
                                <Input
                                    defaultValue={`${Number(supervisor?.paymentPercentage || 0.54) * 100}%`}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Students</Label>
                                <Input defaultValue={supervisor?.maxStudents?.toString() || '10'} disabled className="bg-muted" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button variant="gradient" className="rounded-xl">
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                    </Button>
                </div>
            </div>
        </DashboardLayout>
    )
}
