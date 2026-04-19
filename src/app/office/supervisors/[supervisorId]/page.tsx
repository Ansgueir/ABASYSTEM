import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, MapPin, Award, Users, FileText, Landmark, Calendar, Eye } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/custom-tabs"
import { serialize } from "@/lib/serialize"
import { ManageStudentsDialog, ManageStudentsForm } from "@/components/office/manage-students-dialog"
import { EditableSupervisorContactInfo } from "@/components/shared/editable-contact-info"
import { EditableSupervisorFinancialInfo } from "@/components/office/editable-financial-info"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UploadDocumentDialog } from "@/components/upload-document-dialog"
import { OfficeDocumentActions } from "@/components/office/office-document-actions"
import { SupervisorActivityTab } from "@/components/office/supervisor-activity-tab"

export default async function OfficeSupervisorDetailPage(props: any) {
    const params = await props.params
    const supervisorId = params?.supervisorId
    const tab = "profile"
    const session = await auth()
    if (!session?.user) redirect("/login")
    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") redirect("/login")
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN" || role === "QA"

    // Use `any` cast to avoid stale Prisma type errors
    let supervisor = null;
    try {
        supervisor = await (prisma as any).supervisor.findUnique({
            where: { id: supervisorId },
            include: {
                documents: { orderBy: { uploadedAt: "desc" } },
                studentAssignments: {
                    include: {
                        student: true
                    }
                },
                supervisionHours: {
                    orderBy: { date: "desc" },
                    take: 1000, 
                    include: { student: true }
                },
                contracts: {
                    where: { contract: { status: "SIGNED" } },
                    include: { contract: true }
                },
                groupSessions: {
                    orderBy: { date: "desc" },
                    take: 200,
                    include: { attendance: { include: { student: true } } }
                }
            }
        });
    } catch (error) {
        console.error("Critical error fetching supervisor data:", error);
    }

    if (!supervisor) {
        return (
            <DashboardLayout role="office">
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold text-destructive">Supervisor not found</h2>
                    <Button asChild variant="link" className="mt-4"><Link href="/office/supervisors">Back to List</Link></Button>
                </div>
            </DashboardLayout>
        )
    }

    const safeSupervisor = serialize(supervisor)
    
    // Normalize N:M assignments to a simple students array for UI compatibility
    const assignedStudents = (supervisor.studentAssignments || [])
        .map((sa: any) => sa.student)
        .filter(Boolean)
        .sort((a: any, b: any) => a.fullName.localeCompare(b.fullName))
    
    // Overwrite the (empty or legacy) students property with normalized data
    safeSupervisor.students = assignedStudents

    const totalHoursLogged = (supervisor.supervisionHours ?? []).reduce((s: number, h: any) => s + Number(h.hours), 0)
    const commissionCents = Number(supervisor.paymentPercentage || 0.54) * 100

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Back + Header */}
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
                        <Link href="/office/supervisors">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Supervisors
                        </Link>
                    </Button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-primary/20">
                                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                    {safeSupervisor.fullName?.split(" ").map((n: string) => n[0]).join("") || "SV"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{safeSupervisor.fullName}</h1>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <Award className="h-4 w-4" />
                                    <span>{safeSupervisor.credentialType || "BCBA"}</span>
                                    {safeSupervisor.status === "ACTIVE" && (
                                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ml-2">Active</span>
                                    )}
                                    {safeSupervisor.companyName && (
                                        <>
                                            <span className="mx-1">•</span>
                                            <span>{safeSupervisor.companyName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex divide-x">
                            <div className="px-6 py-3 text-center">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Active Students</p>
                                <p className="text-2xl font-bold">
                                    {Math.max(0, (safeSupervisor.students ?? []).length)} 
                                    <span className="text-sm font-normal text-muted-foreground"> / {Number(safeSupervisor.maxStudents || 10)}</span>
                                </p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Hours Supervised</p>
                                <p className="text-2xl font-bold">{typeof totalHoursLogged === 'number' && !isNaN(totalHoursLogged) ? totalHoursLogged.toFixed(1) : "0.0"}</p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Commission</p>
                                <p className="text-2xl font-bold">{Math.round(commissionCents)}%</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Manage Students moved to Tabs */}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue={tab}>
                    <TabsList className="mb-6 bg-muted/50 p-1 border">
                        <TabsTrigger value="profile" className="px-6 font-medium">Profile</TabsTrigger>
                        <TabsTrigger value="students" className="px-6 font-medium">Students</TabsTrigger>
                        <TabsTrigger value="manage" className="px-6 font-medium">Manage Students</TabsTrigger>
                        <TabsTrigger value="documents" className="px-6 font-medium">Documents</TabsTrigger>
                        <TabsTrigger value="activity" className="px-6 font-medium">Activity Log</TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile">
                        <div className="grid gap-6 md:grid-cols-2">
                            <EditableSupervisorContactInfo supervisor={safeSupervisor} isSuperAdmin={isSuperAdmin} />

                            <EditableSupervisorFinancialInfo supervisor={safeSupervisor} />
                        </div>
                    </TabsContent>

                    <TabsContent value="students">
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                    Assigned Students ({(safeSupervisor.students ?? []).length})
                                </h3>
                            </div>
                            {(safeSupervisor.students ?? []).length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground">No students assigned to this supervisor.</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/10">
                                            <th className="text-left font-medium p-3">Student Name</th>
                                            <th className="text-left font-medium p-3">Email</th>
                                            <th className="text-left font-medium p-3">Type</th>
                                            <th className="text-right font-medium p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(safeSupervisor.students ?? []).map((student: any) => (
                                            <tr key={student.id} className="hover:bg-muted/5 transition-colors">
                                                <td className="p-3 font-medium">{student.fullName}</td>
                                                <td className="p-3 text-muted-foreground">{student.email}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline">{student.fieldworkType}</Badge>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/office/students/${student.id}`}>View Profile</Link>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="manage">
                        <div className="bg-card border rounded-2xl p-8 shadow-sm max-w-4xl">
                            <div className="mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Users className="h-6 w-6 text-primary" />
                                    Manage Student Assignments
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Link students to {safeSupervisor.fullName} or remove existing assignments.
                                </p>
                            </div>
                            <ManageStudentsForm 
                                supervisorId={safeSupervisor.id} 
                                supervisorName={safeSupervisor.fullName} 
                            />
                        </div>
                    </TabsContent>


                    <TabsContent value="documents">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg">Stored Documents</h3>
                            <UploadDocumentDialog targetSupervisorId={supervisorId} />
                        </div>
                        <div className="space-y-3">
                            {(safeSupervisor.documents ?? []).length === 0 ? (
                                <div className="p-10 text-center border border-dashed rounded-xl text-muted-foreground">No documents uploaded.</div>
                            ) : (
                                (safeSupervisor.documents ?? []).map((doc: any) => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                        <div>
                                            <p className="font-medium text-sm">{String(doc.documentType || "OTHER").replace(/_/g, " ")}</p>
                                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${doc.status === "APPROVED" ? "bg-success/10 text-success" :
                                                doc.status === "REJECTED" ? "bg-destructive/10 text-destructive" :
                                                    "bg-muted text-muted-foreground"
                                                }`}>{String(doc.status || "PENDING")}</span>

                                            <OfficeDocumentActions
                                                documentId={doc.id}
                                                fileUrl={doc.fileUrl}
                                                fileName={doc.fileName}
                                                status={doc.status}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="activity">
                        <SupervisorActivityTab 
                            supervisionHours={safeSupervisor.supervisionHours || []} 
                            groupSessions={safeSupervisor.groupSessions || []}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
