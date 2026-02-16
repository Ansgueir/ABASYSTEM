import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap } from "lucide-react"
import Link from "next/link"
import { SupervisorDocumentReview } from "@/components/supervisor-document-review"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function SupervisorStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { documents: { orderBy: { uploadedAt: 'desc' } } }
    })

    if (!student) {
        return (
            <DashboardLayout role="supervisor">
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold text-destructive">Student not found</h2>
                    <Button asChild variant="link" className="mt-4">
                        <Link href="/supervisor/students">Back to List</Link>
                    </Button>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
                        <Link href="/supervisor/students">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
                        </Link>
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 border-2 border-primary/20">
                            <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                {student.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{student.fullName}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                <GraduationCap className="h-4 w-4" />
                                <span>{student.academicDegree || 'Student'}</span>
                                {student.status === 'ACTIVE' && (
                                    <span className="inline-flex items-center rounded-full border border-transparent bg-success/10 px-2 py-0.5 text-xs font-semibold text-success transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-2">Active</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                            <h3 className="font-semibold">Contact Information</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span>{student.email}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{student.phone}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground" />
                                    <span>{student.city}, {student.state}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content - Documents */}
                    <div className="md:col-span-2 space-y-6">
                        <SupervisorDocumentReview documents={student.documents} />
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
