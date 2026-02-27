import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/custom-tabs"
import { OfficeContractsTab } from "@/components/office/contracts-tab"
import { serialize } from "@/lib/serialize"
import { EditStudentDialog } from "@/components/office/edit-student-dialog"
import { EditableStudentBacbInfo } from "@/components/shared/editable-bacb-info"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

export default async function OfficeStudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
    const { studentId } = await params
    const session = await auth()
    if (!session?.user) redirect("/login")
    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")
    const isSuperAdmin = (session.user as any).officeRole === "SUPER_ADMIN"

    // Use `any` cast to avoid stale Prisma type errors after migration until server restarts
    const student = await (prisma as any).student.findUnique({
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
        }
    })

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

    // Serialize student for the edit dialog
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
                                    {student.fullName?.split(" ").map((n: string) => n[0]).join("") || "ST"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight">{student.fullName}</h1>
                                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                                    <GraduationCap className="h-4 w-4" />
                                    <span>{student.academicDegree || "Student"}</span>
                                    {student.status === "ACTIVE" && (
                                        <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ml-2">Active</span>
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
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Contracts</p>
                                <p className="text-2xl font-bold">{(safeStudent.contracts ?? []).length}</p>
                            </div>
                            <div className="px-6 py-3 text-center hidden sm:block">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Documents</p>
                                <p className="text-2xl font-bold">{(student.documents ?? []).length}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <EditStudentDialog student={safeStudent} isSuperAdmin={isSuperAdmin} />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="contracts">
                    <TabsList className="mb-6 bg-muted/50 p-1 border">
                        <TabsTrigger value="contracts" className="px-6">Contracts</TabsTrigger>
                        <TabsTrigger value="contact" className="px-6">Contact Info</TabsTrigger>
                        <TabsTrigger value="documents" className="px-6">Documents</TabsTrigger>
                        <TabsTrigger value="activity" className="px-6">Activity</TabsTrigger>
                        <TabsTrigger value="billing" className="px-6">Billing</TabsTrigger>
                    </TabsList>

                    <TabsContent value="contracts">
                        <OfficeContractsTab
                            studentId={studentId}
                            contracts={safeStudent.contracts ?? []}
                            allSupervisors={allSupervisors}
                        />
                    </TabsContent>

                    <TabsContent value="contact">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="rounded-xl border bg-card p-6 space-y-4">
                                <h3 className="font-semibold text-lg">Contact Information</h3>
                                <div className="grid gap-3 text-sm">
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Mail className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Email</p>
                                            <p className="font-medium">{student.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <Phone className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Phone</p>
                                            <p className="font-medium">{student.phone}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                                        <MapPin className="h-5 w-5 text-primary/70" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Location</p>
                                            <p className="font-medium">{student.city}, {student.state}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <EditableStudentBacbInfo
                                studentId={student.id}
                                initialBacbId={student.bacbId || ""}
                                initialFieldworkType={student.fieldworkType || "REGULAR"}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="documents">
                        <div className="space-y-3">
                            {(student.documents ?? []).length === 0 ? (
                                <div className="p-10 text-center border border-dashed rounded-xl text-muted-foreground">No documents uploaded.</div>
                            ) : (
                                (student.documents ?? []).map((doc: any) => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                                        <div>
                                            <p className="font-medium text-sm">{doc.documentType.replace(/_/g, " ")}</p>
                                            <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                                        </div>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${doc.status === "APPROVED" ? "bg-success/10 text-success" :
                                            doc.status === "REJECTED" ? "bg-destructive/10 text-destructive" :
                                                "bg-muted text-muted-foreground"
                                            }`}>{doc.status}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="activity">
                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="font-semibold text-lg mb-4">Approved Activity Logs</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="text-left font-medium p-3">Date</th>
                                            <th className="text-left font-medium p-3">Type</th>
                                            <th className="text-left font-medium p-3">Hours</th>
                                            <th className="text-left font-medium p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {[...(student.supervisionHours || []), ...(student.independentHours || [])]
                                            .filter((h: any) => h.status === "APPROVED" || h.status === "BILLED")
                                            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                            .map((hour: any) => (
                                                <tr key={hour.id} className="hover:bg-muted/50 transition-colors">
                                                    <td className="p-3">{format(new Date(hour.date), "MMM d, yyyy")}</td>
                                                    <td className="p-3 font-medium">{'activityType' in hour ? 'Supervised' : 'Independent'}</td>
                                                    <td className="p-3">{Number(hour.hours).toFixed(1)} hrs</td>
                                                    <td className="p-3">
                                                        <Badge variant={hour.status === 'BILLED' ? 'default' : 'secondary'}>
                                                            {hour.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))}
                                        {([...(student.supervisionHours || []), ...(student.independentHours || [])].filter((h: any) => h.status === "APPROVED" || h.status === "BILLED").length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                                    No approved or billed activity found.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="billing">
                        <div className="rounded-xl border bg-card p-6">
                            <h3 className="font-semibold text-lg mb-4">Billing History</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-muted-foreground">
                                            <th className="text-left font-medium p-3">Date</th>
                                            <th className="text-right font-medium p-3">Amount Due</th>
                                            <th className="text-right font-medium p-3">Amount Paid</th>
                                            <th className="text-right font-medium p-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {(student.invoices || []).map((invoice: any) => (
                                            <tr key={invoice.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="p-3">{format(new Date(invoice.createdAt), "MMM d, yyyy")}</td>
                                                <td className="p-3 text-right font-medium">${Number(invoice.amountDue).toFixed(2)}</td>
                                                <td className="p-3 text-right text-muted-foreground">${Number(invoice.amountPaid).toFixed(2)}</td>
                                                <td className="p-3 text-right">
                                                    <Badge variant={invoice.status === 'PAID' ? 'default' : 'secondary'}>
                                                        {invoice.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                        {(!student.invoices || student.invoices.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                                                    No billing history available.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    )
}
