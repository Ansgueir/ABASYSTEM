import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { User, Save } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default async function OfficeProfilePage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let officeMember = null

    try {
        officeMember = await prisma.officeMember.findUnique({
            where: { userId: session.user.id }
        })
    } catch (error) {
        console.error("Error fetching office profile:", error)
    }

    const initials = officeMember?.fullName
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase() || 'OF'

    return (
        <DashboardLayout role="office">
            <div className="space-y-6 max-w-3xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold">Profile</h1>
                    <p className="text-muted-foreground">Manage your personal information</p>
                </div>

                {/* Profile Card */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                            <Avatar className="h-24 w-24 border-4 border-primary/20">
                                {session.user.image && <AvatarImage src={session.user.image} />}
                                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="text-center sm:text-left">
                                <h2 className="text-xl font-bold">{officeMember?.fullName || 'Office Staff'}</h2>
                                <p className="text-muted-foreground">{session.user.email}</p>
                                <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                        {officeMember?.officeRole || 'Office Administrator'}
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
                                    defaultValue={officeMember?.fullName || ''}
                                    placeholder="Enter your full name"
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                                <p className="text-xs text-muted-foreground">Contact super-admin to change name.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    defaultValue={session.user.email || ''}
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    defaultValue={''}
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="roleDetails">Position Level</Label>
                                <Input
                                    id="roleDetails"
                                    defaultValue={officeMember?.officeRole || 'Staff'}
                                    disabled
                                    className="bg-muted text-muted-foreground"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
