import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/custom-tabs"
import { DocumentsTab } from "@/components/supervisor/documents-tab"
import { TimesheetsTab } from "@/components/supervisor/timesheets-tab"
import { EditableStudentBacbInfo } from "@/components/shared/editable-bacb-info"

export default async function SupervisorStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "supervisor" && role !== "qa") redirect("/login")

    // Fetch full student profile with documents and both types of hours
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
            documents: { orderBy: { uploadedAt: 'desc' } },
            independentHours: { orderBy: { date: 'desc' } },
            supervisionHours: { orderBy: { date: 'desc' }, include: { supervisor: true } }
        }
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

    // Calculations for the Header
    const totalIndependent = student.independentHours.reduce((sum, h) => sum + Number(h.hours), 0)
    const totalSupervised = student.supervisionHours.reduce((sum, h) => sum + Number(h.hours), 0)
    const totalHours = totalIndependent + totalSupervised

    // Serialization for client components (converting Decimal to Number)
    const serializedIndependent = student.independentHours.map(h => ({
        ...h,
        hours: Number(h.hours)
    }))
    const serializedSupervision = student.supervisionHours.map(h => ({
        ...h,
        hours: Number(h.hours),
        amountBilled: h.amountBilled ? Number(h.amountBilled) : null,
        supervisorPay: h.supervisorPay ? Number(h.supervisorPay) : null
    }))

    return (
        <DashboardLayout role="supervisor">
            <div className="space-y-6">
                {/* Header Section */}
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
                        <Link href="/supervisor/students">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
                        </Link>
                    </Button>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex divide-x">
                            <div className="px-6 py-3 text-center">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Hours</p>
                                <p className="text-2xl font-bold">{totalHours.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">/ 130</span></p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Documents</p>
                                <p className="text-2xl font-bold">{student.documents.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Dashboard Navigation */}
                <Tabs defaultValue="documents">
                    <TabsList className="mb-6 bg-muted/50 p-1 border">
                        <TabsTrigger value="documents" className="px-6">Documents</TabsTrigger>
                        <TabsTrigger value="timesheets" className="px-6">Timesheets Audit</TabsTrigger>
                        <TabsTrigger value="contact" className="px-6">Contact Info</TabsTrigger>
                        <TabsTrigger value="contracts" className="px-6">Contracts</TabsTrigger>
                    </TabsList>

                    <TabsContent value="documents">
                        <DocumentsTab documents={student.documents} />
                    </TabsContent>

                    <TabsContent value="timesheets">
                        <TimesheetsTab
                            independentHours={serializedIndependent}
                            supervisionHours={serializedSupervision}
                        />
                    </TabsContent>

                    <TabsContent value="contact">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                                <h3 className="font-semibold text-lg">Contact Information</h3>
                                <div className="grid gap-4 text-sm mt-4">
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Mail className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Email Address</p>
                                            <p className="font-medium text-base">{student.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Phone className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Phone Number</p>
                                            <p className="font-medium text-base">{student.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <MapPin className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Location</p>
                                            <p className="font-medium text-base">{student.city}, {student.state}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                                <h3 className="font-semibold text-lg">Supervisor Notes</h3>
                                <div className="p-4 rounded-lg bg-yellow-50/50 border border-yellow-100 min-h-[150px]">
                                    <p className="text-sm text-yellow-900 italic">
                                        {student.notes || "No additional notes have been registered for this student."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <EditableStudentBacbInfo
                                studentId={student.id}
                                initialBacbId={student.bacbId || ""}
                                initialFieldworkType={(student as any).fieldworkType || "REGULAR"}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="contracts">
                        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-muted/10 border-dashed">
                            <div className="p-4 rounded-full bg-muted mb-4">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">Contract Generation</h3>
                            <p className="text-muted-foreground max-w-sm mt-2">
                                Automatic generation of Monthly Forms and Supervision Contracts is currently in development.
                            </p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}

function FileText(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    )
}
