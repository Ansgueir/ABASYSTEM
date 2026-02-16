import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, Plus, Filter, MoreHorizontal } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddSupervisorDialog } from "@/components/office/add-supervisor-dialog"
import { UserActions } from "@/components/office/user-actions"

export default async function OfficeSupervisorsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let supervisors: any[] = []

    try {
        supervisors = await prisma.supervisor.findMany({
            orderBy: { fullName: 'asc' },
            include: {
                _count: { select: { students: true } },
                user: { select: { isActive: true, email: true } }
            }
        })
    } catch (error) {
        console.error("Error fetching supervisors:", error)
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Supervisors</h1>
                        <p className="text-muted-foreground">Manage all registered supervisors</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search supervisors..." className="pl-10" />
                        </div>
                        <Button variant="outline" className="rounded-xl">
                            <Filter className="h-4 w-4" />
                        </Button>
                        <AddSupervisorDialog />
                    </div>
                </div>

                {/* Supervisors Table */}
                <Card>
                    <CardContent className="p-0">
                        {supervisors.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No supervisors registered yet</p>
                                <div className="mt-4 flex justify-center">
                                    <AddSupervisorDialog />
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left p-4 font-medium">Supervisor</th>
                                            <th className="text-left p-4 font-medium hidden md:table-cell">Credential</th>
                                            <th className="text-left p-4 font-medium hidden lg:table-cell">Students</th>
                                            <th className="text-left p-4 font-medium hidden sm:table-cell">Commission</th>
                                            <th className="text-right p-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supervisors.map((supervisor) => (
                                            <tr key={supervisor.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border-2 border-success/20">
                                                            <AvatarFallback className="bg-success/10 text-success text-sm">
                                                                {supervisor.fullName?.split(' ').map((n: string) => n[0]).join('') || 'SV'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{supervisor.fullName}</p>
                                                            <p className="text-sm text-muted-foreground">{supervisor.email || 'No email'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                                                        {supervisor.credentialType || 'BCBA'}
                                                    </span>
                                                </td>
                                                <td className="p-4 hidden lg:table-cell">
                                                    <span className="text-sm">{supervisor._count?.students || 0} / {supervisor.maxStudents || 10}</span>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell">
                                                    <span className="text-sm font-medium">{Number(supervisor.paymentPercentage || 0.54) * 100}%</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <UserActions
                                                            id={supervisor.id}
                                                            userId={supervisor.userId}
                                                            name={supervisor.fullName}
                                                            email={supervisor.email}
                                                            type="supervisor"
                                                            isActive={supervisor.user?.isActive ?? true}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
