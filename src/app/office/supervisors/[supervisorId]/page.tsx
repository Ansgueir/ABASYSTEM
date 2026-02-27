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
import { EditSupervisorDialog } from "@/components/office/edit-supervisor-dialog"
import { ManageStudentsDialog } from "@/components/office/manage-students-dialog"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { UploadDocumentDialog } from "@/components/upload-document-dialog"
import { OfficeDocumentActions } from "@/components/office/office-document-actions"

export default async function OfficeSupervisorDetailPage({ params }: { params: Promise<{ supervisorId: string }> }) {
    const { supervisorId } = await params
    const session = await auth()
    if (!session?.user) redirect("/login")
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN"

    // Use `any` cast to avoid stale Prisma type errors
    const supervisor = await (prisma as any).supervisor.findUnique({
        where: { id: supervisorId },
        include: {
            documents: { orderBy: { uploadedAt: "desc" } },
            students: {
                orderBy: { fullName: "asc" }
            },
            supervisionHours: {
                orderBy: { date: "desc" },
                take: 100, // Limit shown history to latest 100 for performance
                include: { student: true }
            },
            contracts: {
                where: { contract: { status: "SIGNED" } },
                include: { contract: true }
            }
        }
    })

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
                                    {supervisor.fullName?.split(" ").map((n: string) => n[0]).join("") || "SV"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{supervisor.fullName}</h1>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <Award className="h-4 w-4" />
                                    <span>{supervisor.credentialType || "BCBA"}</span>
                                    {supervisor.status === "ACTIVE" && (
                                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ml-2">Active</span>
                                    )}
                                    {supervisor.companyName && (
                                        <>
                                            <span className="mx-1">•</span>
                                            <span>{supervisor.companyName}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex divide-x">
                            <div className="px-6 py-3 text-center">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Active Students</p>
                                <p className="text-2xl font-bold">{(supervisor.students ?? []).length} <span className="text-sm font-normal text-muted-foreground">/ {supervisor.maxStudents || 10}</span></p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Hours Supervised</p>
                                <p className="text-2xl font-bold">{totalHoursLogged.toFixed(1)}</p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Commission</p>
                                <p className="text-2xl font-bold">{commissionCents}%</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <ManageStudentsDialog supervisorId={supervisor.id} supervisorName={supervisor.fullName} />
                            {isSuperAdmin && <EditSupervisorDialog supervisor={safeSupervisor} />}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="contact">
                    <TabsList className="mb-6 bg-muted/50 p-1 border">
                        <TabsTrigger value="contact" className="px-6">Details & Banking</TabsTrigger>
                        <TabsTrigger value="students" className="px-6">Students</TabsTrigger>
                        <TabsTrigger value="documents" className="px-6">Documents</TabsTrigger>
                        <TabsTrigger value="activity" className="px-6">Activity Log</TabsTrigger>
                    </TabsList>

                    <TabsContent value="contact">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-xl border bg-card p-6 space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-muted-foreground" />
                                    Contact & Certification Information
                                </h3>
                                <div className="grid gap-3 text-sm">
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Mail className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">Email Address</p>
                                            <p className="font-medium">{supervisor.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Phone className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">Phone Number</p>
                                            <p className="font-medium">{supervisor.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <MapPin className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                                            <p className="font-medium">{supervisor.address}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Award className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-0.5">BACB & Certification ID</p>
                                            <p className="font-medium">BACB: {supervisor.bacbId} • Cert: {supervisor.certificantNumber}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                            <Calendar className="h-5 w-5 text-primary/70" />
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">Exam Date</p>
                                                <p className="font-medium text-xs">{supervisor.examDate ? format(new Date(supervisor.examDate), "MMM d, yyyy") : "-"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                            <Calendar className="h-5 w-5 text-primary/70" />
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">8Hr Training</p>
                                                <p className="font-medium text-xs">{supervisor.training8hrDate ? format(new Date(supervisor.training8hrDate), "MMM d, yyyy") : "-"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border bg-card p-6 space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <Landmark className="h-5 w-5 text-muted-foreground" />
                                    Financial & Banking Information
                                </h3>
                                <div className="grid gap-3 text-sm">
                                    <div className="px-4 py-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                        <span className="text-muted-foreground">Company Name</span>
                                        <span className="font-medium">{supervisor.companyName || "N/A"}</span>
                                    </div>
                                    <div className="px-4 py-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                        <span className="text-muted-foreground">Tax ID / EIN</span>
                                        <span className="font-medium font-mono">{supervisor.taxId || "N/A"}</span>
                                    </div>
                                    <div className="px-4 py-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                        <span className="text-muted-foreground">Bank Name</span>
                                        <span className="font-medium">{supervisor.bankName || "N/A"}</span>
                                    </div>
                                    <div className="px-4 py-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                        <span className="text-muted-foreground">Routing Number</span>
                                        <span className="font-medium font-mono">{supervisor.routingNumber || "N/A"}</span>
                                    </div>
                                    <div className="px-4 py-3 bg-muted/30 rounded-lg flex justify-between items-center">
                                        <span className="text-muted-foreground">Account Number</span>
                                        <span className="font-medium font-mono">
                                            {supervisor.accountNumber ? `••••${supervisor.accountNumber.slice(-4)}` : "N/A"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="students">
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <Users className="h-5 w-5 text-muted-foreground" />
                                    Assigned Students ({(supervisor.students ?? []).length})
                                </h3>
                            </div>
                            {(supervisor.students ?? []).length === 0 ? (
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
                                        {(supervisor.students ?? []).map((student: any) => (
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

                    <TabsContent value="documents">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-lg">Stored Documents</h3>
                            <UploadDocumentDialog targetSupervisorId={supervisorId} />
                        </div>
                        <div className="space-y-3">
                            {(supervisor.documents ?? []).length === 0 ? (
                                <div className="p-10 text-center border border-dashed rounded-xl text-muted-foreground">No documents uploaded.</div>
                            ) : (
                                (supervisor.documents ?? []).map((doc: any) => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                        <div>
                                            <p className="font-medium text-sm">{doc.documentType.replace(/_/g, " ")}</p>
                                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${doc.status === "APPROVED" ? "bg-success/10 text-success" :
                                                doc.status === "REJECTED" ? "bg-destructive/10 text-destructive" :
                                                    "bg-muted text-muted-foreground"
                                                }`}>{doc.status}</span>

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
                    </TabsContent>

                    <TabsContent value="activity">
                        <div className="rounded-xl border bg-card overflow-hidden">
                            {(supervisor.supervisionHours ?? []).length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground">No activity logs found.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/10">
                                                <th className="text-left font-medium p-3">Date</th>
                                                <th className="text-left font-medium p-3">Student</th>
                                                <th className="text-left font-medium p-3">Activity</th>
                                                <th className="text-left font-medium p-3">Hours</th>
                                                <th className="text-left font-medium p-3">Status</th>
                                                <th className="text-right font-medium p-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(supervisor.supervisionHours ?? []).map((hour: any) => (
                                                <tr key={hour.id} className="hover:bg-muted/5 transition-colors">
                                                    <td className="p-3 whitespace-nowrap">{format(new Date(hour.date), "MMM d, yyyy")}</td>
                                                    <td className="p-3 font-medium">{hour.student?.fullName || 'Multiple Students'}</td>
                                                    <td className="p-3 text-muted-foreground">{hour.activityType?.replace(/_/g, ' ') || 'Group Supervision'}</td>
                                                    <td className="p-3">{Number(hour.hours).toFixed(1)} hrs</td>
                                                    <td className="p-3">
                                                        <Badge variant={hour.status === 'APPROVED' ? 'default' : hour.status === 'BILLED' ? 'default' : hour.status === 'REJECTED' ? 'destructive' : 'secondary'}>
                                                            {hour.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <Dialog>
                                                            <DialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                                </Button>
                                                            </DialogTrigger>
                                                            <DialogContent className="sm:max-w-md">
                                                                <DialogHeader>
                                                                    <DialogTitle>Activity Details</DialogTitle>
                                                                </DialogHeader>
                                                                <div className="space-y-4 py-4 text-sm">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs">Date</p>
                                                                            <p className="font-medium">{format(new Date(hour.date), "MMMM d, yyyy")}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs">Duration</p>
                                                                            <p className="font-medium">{Number(hour.hours).toFixed(1)} hrs</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs">Student</p>
                                                                            <p className="font-medium">{hour.student?.fullName || 'Multiple Students'}</p>
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-muted-foreground text-xs">Status</p>
                                                                            <Badge variant={hour.status === 'APPROVED' ? 'default' : hour.status === 'BILLED' ? 'default' : hour.status === 'REJECTED' ? 'destructive' : 'secondary'} className="mt-1">
                                                                                {hour.status}
                                                                            </Badge>
                                                                        </div>
                                                                        <div className="col-span-2 border-t pt-4 mt-2">
                                                                            <p className="text-muted-foreground text-xs">Activity Type</p>
                                                                            <p className="font-medium">{hour.activityType?.replace(/_/g, ' ') || 'Group Supervision'}</p>
                                                                        </div>
                                                                        {hour.setting && (
                                                                            <div className="col-span-2">
                                                                                <p className="text-muted-foreground text-xs">Setting</p>
                                                                                <p className="font-medium">{hour.setting?.replace(/_/g, ' ')}</p>
                                                                            </div>
                                                                        )}
                                                                        {hour.notes && (
                                                                            <div className="col-span-2 border-t pt-4 mt-2">
                                                                                <p className="text-muted-foreground text-xs">Notes</p>
                                                                                <p className="italic bg-muted/30 p-3 rounded-lg mt-1">{hour.notes}</p>
                                                                            </div>
                                                                        )}
                                                                        {hour.groupTopic && (
                                                                            <div className="col-span-2 border-t pt-4 mt-2">
                                                                                <p className="text-muted-foreground text-xs">Group Topic</p>
                                                                                <p className="font-medium">{hour.groupTopic}</p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </DialogContent>
                                                        </Dialog>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        {(supervisor.supervisionHours ?? []).length === 100 && (
                                            <tfoot>
                                                <tr>
                                                    <td colSpan={5} className="p-4 text-center text-muted-foreground text-xs italic">
                                                        Showing latest 100 entries. For older data, run a report.
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
