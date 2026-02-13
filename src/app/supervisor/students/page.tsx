import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, ArrowRight, Clock, Calendar } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"

export default async function SupervisorStudentsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    let students: any[] = []

    try {
        const supervisor = await prisma.supervisor.findUnique({
            where: { userId: session.user.id },
            include: {
                students: {
                    orderBy: { fullName: 'asc' }
                }
            }
        })

        if (supervisor) {
            students = supervisor.students
        }
    } catch (error) {
        console.error("Error fetching students:", error)
    }

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">My Students</h1>
                        <p className="text-muted-foreground">Manage and track your assigned students</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search students..." className="pl-10" />
                    </div>
                </div>

                {/* Students Grid */}
                {students.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No students assigned yet</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {students.map((student) => {
                            const progress = Math.round(Math.random() * 100) // Mock progress
                            return (
                                <Card key={student.id} className="hover:shadow-elevated transition-all cursor-pointer">
                                    <CardContent className="pt-6">
                                        <div className="flex items-start gap-4">
                                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                                    {student.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold truncate">{student.fullName}</h3>
                                                <p className="text-sm text-muted-foreground">{student.academicDegree || 'Student'}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 space-y-3">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground">Monthly Progress</span>
                                                <span className="font-medium">{progress}%</span>
                                            </div>
                                            <Progress value={progress} className="h-2" />

                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-4 w-4" />
                                                    <span>{student.hoursPerMonth || 130}h/mo</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Calendar className="h-4 w-4" />
                                                    <span>Active</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button variant="ghost" size="sm" className="w-full mt-4 rounded-xl" asChild>
                                            <Link href={`/supervisor/students/${student.id}`}>
                                                View Details <ArrowRight className="h-4 w-4 ml-1" />
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
