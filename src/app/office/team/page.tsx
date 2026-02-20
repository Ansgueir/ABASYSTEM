import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AddOfficeMemberDialog } from "@/components/office/add-office-member-dialog"
import { ShieldCheck, UserCog, Mail, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { UserActions } from "@/components/office/user-actions"

export default async function OfficeTeamPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    // Verify role
    // @ts-ignore
    if (session.user.role !== "OFFICE") redirect("/login")

    // Check if user is Super Admin for write permissions
    // @ts-ignore
    const isSuperAdmin = session.user.officeRole === "SUPER_ADMIN"

    // Fetch team members
    const teamMembers = await prisma.user.findMany({
        where: {
            role: "OFFICE"
        },
        include: {
            officeMember: true
        },
        orderBy: {
            createdAt: "desc"
        }
    })

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Office Team</h2>
                        <p className="text-muted-foreground">
                            {isSuperAdmin
                                ? "Manage administrators and their permissions."
                                : "View the office team roster."}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search team members..." className="pl-10" />
                        </div>
                        {isSuperAdmin && <AddOfficeMemberDialog />}
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left p-4 font-medium">Name</th>
                                        <th className="text-left p-4 font-medium hidden sm:table-cell">Role</th>
                                        <th className="text-left p-4 font-medium hidden md:table-cell">Email</th>
                                        <th className="text-left p-4 font-medium">Status</th>
                                        {isSuperAdmin && <th className="text-right p-4 font-medium">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {teamMembers.map((member) => (
                                        <tr key={member.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-blue-100 p-2 rounded-full hidden sm:block">
                                                        <UserCog className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">{member.officeMember?.fullName || "Unknown"}</p>
                                                        <p className="text-xs text-muted-foreground sm:hidden">{member.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <Badge variant={member.officeMember?.officeRole === "SUPER_ADMIN" ? "default" : "secondary"}>
                                                    {member.officeMember?.officeRole?.replace("_", " ") || "ADMIN"}
                                                </Badge>
                                            </td>
                                            <td className="p-4 hidden md:table-cell text-sm text-gray-600">
                                                {member.email}
                                            </td>
                                            <td className="p-4">
                                                <span className={`text-xs px-2 py-1 rounded-full ${
                                                    // @ts-ignore
                                                    member.isActive !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    }`}>
                                                    {/* @ts-ignore */}
                                                    {member.isActive !== false ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            {isSuperAdmin && (
                                                <td className="p-4 text-right">
                                                    <UserActions
                                                        // @ts-ignore
                                                        id={member.officeMember?.id || ""}
                                                        userId={member.id}
                                                        name={member.officeMember?.fullName || "User"}
                                                        email={member.email}
                                                        type="office"
                                                        // @ts-ignore
                                                        isActive={member.isActive !== false}
                                                        fullData={member.officeMember}
                                                        isSuperAdmin={isSuperAdmin}
                                                    />
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
