import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap, Eye } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/custom-tabs"
import { OfficeContractsTab } from "@/components/office/contracts-tab"
import { serialize } from "@/lib/serialize"
import { EditableStudentContactInfo, EditableStudentBacbFieldwork } from "@/components/shared/editable-contact-info"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UploadDocumentDialog } from "@/components/upload-document-dialog"
import { OfficeDocumentActions } from "@/components/office/office-document-actions"
import { FinancialPeriodsTab } from "@/components/office/financial-periods-tab"
import { StudentActivityTab } from "@/components/office/student-activity-tab"
import { StudentBillingTab } from "@/components/office/student-billing-tab"
import { DebugErrorBoundary } from "@/components/debug-error-boundary"
import { SupervisorNotesCard } from "@/components/shared/supervisor-notes-card"

export default async function OfficeStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params
    const session = await auth()
    if (!session?.user) redirect("/login")
    const role = String((session.user as any).role).toUpperCase()
    if (role !== "OFFICE" && role !== "QA") redirect("/login")
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN" || role === "QA"

    // Use `any` cast to avoid stale Prisma type errors after migration until server restarts
    let student = null;
    try {
        student = await (prisma as any).student.findUnique({
            where: { id: studentId },
            include: {
                documents: { orderBy: { uploadedAt: "desc" } },
                contracts: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        supervisors: {
                            include: {
                                supervisor: true
                            }
                        }
                    }
                },
                independentHours: { orderBy: { date: "desc" } },
                supervisionHours: { orderBy: { date: "desc" } },
                invoices: { orderBy: { createdAt: "desc" } },
                // removed financialPeriods as it is not present in the current production schema
            }
        });
    } catch (error) {
        console.error("Critical error fetching student data:", error);
        // We catch here so the page can at least render a "not found" or error state instead of crashing the whole app
    }

    if (!student) {
        return (
            <DashboardLayout role="office">
                <div className="p-8 text-center">
                    <h2 className="text-xl font-semibold text-destructive">Student not found</h2>
                    <Button asChild variant="link" className="mt-4"><Link href="/office/students">Back to List</Link></Button>
                </div>
            </DashboardLayout>
        )
    }

    // All active supervisors for the multi-select — serialize to avoid Decimal crash
    const rawSupervisors = await prisma.supervisor.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, fullName: true, bacbId: true, credentialType: true },
        orderBy: { fullName: "asc" }
    })
    const allSupervisors = serialize(rawSupervisors)

    const totalHours =
        (student.independentHours ?? []).reduce((s: number, h: any) => s + Number(h.hours), 0) +
        (student.supervisionHours ?? []).reduce((s: number, h: any) => s + Number(h.hours), 0)

    // Double-serialized: first pass type-converts (Decimal/Date/BigInt),
    // second pass JSON round-trip nukes any residual non-serializable object
    // (the source of the "Objects are not valid as a React child {month, year}" crash).
    const safeStudent = serialize(student)


    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Back + Header */}
                <div>
                    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2 text-muted-foreground">
                        <Link href="/office/students">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Students
                        </Link>
                    </Button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 border-2 border-primary/20">
                                <AvatarFallback className="text-lg bg-primary/10 text-primary">
                                    {String(safeStudent.fullName || "").split(" ").map((n: string) => n[0]).join("") || "ST"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{String(safeStudent.fullName || "")}</h1>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <GraduationCap className="h-4 w-4" />
                                    <span>{typeof safeStudent.academicDegree === 'object' ? JSON.stringify(safeStudent.academicDegree) : String(safeStudent.academicDegree || "Student")}</span>
                                    {safeStudent.status === "ACTIVE" && (
                                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ml-2">Active</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex divide-x">
                            <div className="px-6 py-3 text-center">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Hours</p>
                                <p className="text-2xl font-bold">
                                    {typeof totalHours === 'number' && !isNaN(totalHours) ? totalHours.toFixed(1) : "0.0"} 
                                    <span className="text-sm font-normal text-muted-foreground"> / 130</span>
                                </p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Contracts</p>
                                <p className="text-2xl font-bold">{Math.max(0, (safeStudent.contracts || []).length)}</p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Documents</p>
                                <p className="text-2xl font-bold">{Math.max(0, (safeStudent.documents ?? []).length)}</p>
                            </div>
                        </div>
                        {/* Global edit profile button removed */}
                    </div>
                </div>

                {/* Tabs */}
                <DebugErrorBoundary>
                    <Tabs defaultValue="contracts">
                        <TabsList className="mb-6 bg-muted/50 p-1 border">
                            <TabsTrigger value="contracts" className="px-6">Contracts</TabsTrigger>
                            <TabsTrigger value="profile" className="px-6">Profile</TabsTrigger>
                            <TabsTrigger value="documents" className="px-6">Documents</TabsTrigger>
                            <TabsTrigger value="activity" className="px-6">Activity</TabsTrigger>
                            <TabsTrigger value="billing" className="px-6">Billing</TabsTrigger>
                            {isSuperAdmin && <TabsTrigger value="periods" className="px-6">Periods</TabsTrigger>}
                        </TabsList>

                        <TabsContent value="contracts">
                            <DebugErrorBoundary title="Contracts Tab Error">
                                <OfficeContractsTab
                                    studentId={studentId}
                                    contracts={safeStudent.contracts ?? []}
                                    allSupervisors={allSupervisors}
                                />
                            </DebugErrorBoundary>
                        </TabsContent>

                        <TabsContent value="profile">
                            <DebugErrorBoundary title="Profile Tab Error">
                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-6">
                                        <EditableStudentContactInfo student={safeStudent} isSuperAdmin={isSuperAdmin} />
                                        <SupervisorNotesCard 
                                            studentId={safeStudent.id} 
                                            notes={safeStudent.notes} 
                                            canEdit={true} 
                                        />
                                    </div>
                                    <EditableStudentBacbFieldwork student={safeStudent} isSuperAdmin={isSuperAdmin} />
                                </div>
                            </DebugErrorBoundary>
                        </TabsContent>

                        {safeStudent.financialPeriods && isSuperAdmin && (
                            <TabsContent value="periods">
                                <FinancialPeriodsTab studentId={studentId} periods={safeStudent.financialPeriods || []} />
                            </TabsContent>
                        )}

                        <TabsContent value="documents">
                            <DebugErrorBoundary title="Documents Tab Error">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold text-lg">Stored Documents</h3>
                                    <UploadDocumentDialog targetStudentId={studentId} />
                                </div>
                                <div className="space-y-3">
                                    {(safeStudent.documents ?? []).length === 0 ? (
                                        <div className="p-10 text-center border border-dashed rounded-xl text-muted-foreground">No documents uploaded.</div>
                                    ) : (
                                        (safeStudent.documents ?? []).map((doc: any) => (
                                            <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                                <div>
                                                    <p className="font-medium text-sm">{String(doc.documentType || "OTHER").replace(/_/g, " ")}</p>
                                                    <p className="text-xs text-muted-foreground">{String(doc.fileName || "")}</p>
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
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DebugErrorBoundary>
                        </TabsContent>
                        <TabsContent value="activity">
                            <StudentActivityTab 
                                supervisionHours={safeStudent.supervisionHours || []} 
                                independentHours={safeStudent.independentHours || []} 
                            />
                        </TabsContent>

                        <TabsContent value="billing">
                            <StudentBillingTab 
                                invoices={safeStudent.invoices || []} 
                            />
                        </TabsContent>
                    </Tabs>
                </DebugErrorBoundary>
            </div>
        </DashboardLayout>
    )
}
