import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GraduationCap, Search, Plus, Filter, ArrowRight, MoreHorizontal, Eye } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddStudentDialog } from "@/components/office/add-student-dialog"
import { UserActions } from "@/components/office/user-actions"
import Link from "next/link"

export default async function OfficeStudentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let students: any[] = []

    try {
        students = await prisma.student.findMany({
            orderBy: { fullName: 'asc' },
            include: {
                supervisor: true,
                user: {
                    select: { isActive: true, email: true }
                }
            }
        })
    } catch (error) {
        console.error("Error fetching students:", error)
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Students</h1>
                        <p className="text-muted-foreground">Manage all registered students</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search students..." className="pl-10" />
                        </div>
                        <Button variant="outline" className="rounded-xl">
                            <Filter className="h-4 w-4" />
                        </Button>
                        <AddStudentDialog />
                    </div>
                </div>

                {/* Students Table */}
                <Card>
                    <CardContent className="p-0">
                        {students.length === 0 ? (
                            <div className="text-center py-12">
                                <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No students registered yet</p>
                                <div className="mt-4 flex justify-center">
                                    <AddStudentDialog />
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="text-left p-4 font-medium">Student</th>
                                            <th className="text-left p-4 font-medium hidden md:table-cell">Supervisor</th>
                                            <th className="text-left p-4 font-medium hidden lg:table-cell">Degree</th>
                                            <th className="text-left p-4 font-medium hidden sm:table-cell">Status</th>
                                            <th className="text-right p-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => (
                                            <tr key={student.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border-2 border-primary/20">
                                                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                                {student.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="font-medium">{student.fullName}</p>
                                                            <p className="text-sm text-muted-foreground">{student.email || 'No email'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <span className="text-sm">{student.supervisor?.fullName || 'Not assigned'}</span>
                                                </td>
                                                <td className="p-4 hidden lg:table-cell">
                                                    <span className="text-sm">{student.academicDegree || '-'}</span>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell">
                                                    <span className={`text-xs px-2 py-1 rounded-full ${!student.user.isActive
                                                        ? 'bg-red-100 text-red-700'
                                                        : student.status === 'ACTIVE'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-muted text-muted-foreground'
                                                        }`}>
                                                        {!student.user.isActive ? 'INACTIVE' : (student.status || 'PENDING')}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="sm" asChild className="gap-1">
                                                            <Link href={`/office/students/${student.id}`}>
                                                                <Eye className="h-4 w-4" /> View
                                                            </Link>
                                                        </Button>
                                                        <UserActions
                                                            id={student.id}
                                                            userId={student.userId}
                                                            name={student.fullName}
                                                            email={student.email}
                                                            type="student"
                                                            isActive={student.user?.isActive ?? true}
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
