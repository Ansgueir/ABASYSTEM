import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, Clock, CheckCircle, Download, ChevronUp, ChevronDown, ArrowUpDown, Search } from "lucide-react"
import { Label } from "@/components/ui/label"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReviewSupervisionLogActions } from "@/components/office/review-supervision-log-actions"
import Link from "next/link"
import { serialize } from "@/lib/serialize"

export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"

export default async function SupervisionLogsReviewPage({
    searchParams
}: {
    searchParams: Promise<{ tab?: string, sortBy?: string, order?: string, search?: string, student?: string, supervisor?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    const officeRole = String((session.user as any).officeRole).toUpperCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const params = await searchParams
    const activeTab = (params.tab || "PENDING").toUpperCase()
    const validTabs = ["PENDING", "APPROVED", "REJECTED", "BILLED"]
    const statusFilter = validTabs.includes(activeTab) ? activeTab : "PENDING"
    
    // Excel-style Filters
    const selectedStudent = params.student || ""
    const selectedSupervisor = params.supervisor || ""

    // Sorting Logic
    const sortBy = params.sortBy || "date"
    const order = params.order === "asc" ? "asc" : "desc"

    let logs: any[] = []
    let filterOptions = { students: [] as string[], supervisors: [] as string[] }
    let error: string | null = null
 
    try {
        // Build separated filters for each model
        const supervisionWhere: any = { status: statusFilter as any }
        if (selectedStudent) supervisionWhere.student = { fullName: { equals: selectedStudent, mode: 'insensitive' } }
        if (selectedSupervisor) supervisionWhere.supervisor = { fullName: { equals: selectedSupervisor, mode: 'insensitive' } }

        const independentWhere: any = { status: statusFilter as any }
        if (selectedStudent) independentWhere.student = { fullName: { equals: selectedStudent, mode: 'insensitive' } }

        // Fetch dynamic lists for the filter dropdowns (defensive fetch)
        const [allPossibleStudents, allPossibleSupervisors] = await Promise.all([
            prisma.student.findMany({ select: { fullName: true }, orderBy: { fullName: 'asc' } }).catch(() => []),
            prisma.supervisor.findMany({ select: { fullName: true }, orderBy: { fullName: 'asc' } }).catch(() => [])
        ])
        
        filterOptions.students = Array.from(new Set(allPossibleStudents.map(s => s?.fullName).filter(Boolean))) as string[]
        filterOptions.supervisors = Array.from(new Set(allPossibleSupervisors.map(s => s?.fullName).filter(Boolean))) as string[]

        // We use 'date' as a safe default for any unknown sortBy key
        const safeSortBy = ["date", "startTime", "hours"].includes(sortBy) ? sortBy : "date"

        const [supervisionLogs, independentLogs] = await Promise.all([
            prisma.supervisionHour.findMany({
                where: supervisionWhere,
                orderBy: { [safeSortBy]: order },
                include: {
                    student: { select: { fullName: true } },
                    supervisor: { select: { fullName: true } }
                }
            }).catch(e => { console.error(e); return [] }),
            prisma.independentHour.findMany({
                where: independentWhere,
                orderBy: { [safeSortBy]: order },
                include: {
                    student: { select: { fullName: true } }
                }
            }).catch(e => { console.error(e); return [] })
        ])

        // Safe combine logic
        const combined = [
            ...supervisionLogs.map(l => ({ ...l, type: 'SUPERVISED' })),
            ...(selectedSupervisor ? [] : independentLogs.map(l => ({ 
                ...l, 
                type: 'INDEPENDENT', 
                supervisor: { fullName: 'N/A (Indep.)' },
                supervisionType: 'N/A' 
            })))
        ]

        // Refined Sort Logic with explicit any casting to avoid TS index errors
        logs = (combined as any[]).sort((a, b) => {
            if (sortBy === 'supervisor') {
                const valA = a.supervisor?.fullName || ""
                const valB = b.supervisor?.fullName || ""
                return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
            }
            if (sortBy === 'student') {
                const valA = a.student?.fullName || ""
                const valB = b.student?.fullName || ""
                return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
            }
            
            // Default Chronological Sort
            const field = safeSortBy as keyof typeof a
            const timeA = new Date(a[field] || a.date).getTime()
            const timeB = new Date(b[field] || b.date).getTime()
            return order === 'asc' ? timeA - timeB : timeB - timeA
        })

    } catch (e: any) {
        console.error("Critical error loading Review Logs:", e)
        error = e.message || "An unexpected error occurred while loading logs."
    }

    if (error) {
        return (
            <DashboardLayout role="office">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-4 p-6 bg-destructive/5 rounded-3xl border border-destructive/10">
                        <div className="text-destructive text-xl font-bold">Error loading logs</div>
                        <p className="text-muted-foreground max-w-sm mx-auto">{error}</p>
                        <Button className="rounded-xl" onClick={() => window.location.reload()}>Try Again</Button>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Review Logs</h1>
                        <p className="text-muted-foreground">Audit and manage supervision entries</p>
                    </div>
                   <div className="flex items-center gap-2">
                        <a href={`/api/office/supervision-logs/export?status=${statusFilter}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="rounded-xl">
                                <Download className="h-4 w-4 mr-2" />
                                Export Excel
                            </Button>
                        </a>
                   </div>
                </div>

                {/* ADVANCED FILTER BAR (Excel Style) */}
                <div className="bg-muted/30 p-4 rounded-2xl border border-border flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filter Student</Label>
                        <form action="" method="get">
                            <input type="hidden" name="tab" value={activeTab.toLowerCase()} />
                            <input type="hidden" name="supervisor" value={selectedSupervisor} />
                            <input type="hidden" name="sortBy" value={sortBy} />
                            <input type="hidden" name="order" value={order} />
                            <select 
                                name="student"
                                defaultValue={selectedStudent}
                                className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                                onChange={(e) => e.target.form?.submit()}
                            >
                                <option value="">- All Students -</option>
                                {filterOptions.students.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </form>
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-[200px]">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filter Supervisor</Label>
                        <form action="" method="get">
                            <input type="hidden" name="tab" value={activeTab.toLowerCase()} />
                            <input type="hidden" name="student" value={selectedStudent} />
                            <input type="hidden" name="sortBy" value={sortBy} />
                            <input type="hidden" name="order" value={order} />
                            <select 
                                name="supervisor"
                                defaultValue={selectedSupervisor}
                                className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                                onChange={(e) => e.target.form?.submit()}
                            >
                                <option value="">- All Supervisors -</option>
                                {filterOptions.supervisors.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </form>
                    </div>

                    {(selectedStudent || selectedSupervisor) && (
                        <Link href={`/office/supervision-logs?tab=${activeTab.toLowerCase()}`}>
                            <Button variant="ghost" className="h-10 text-xs text-muted-foreground hover:text-destructive">
                                Clear Filters
                            </Button>
                        </Link>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
                    {validTabs.map((tab) => (
                        <Link
                            key={tab}
                            href={`/office/supervision-logs?tab=${tab.toLowerCase()}&student=${selectedStudent}&supervisor=${selectedSupervisor}&sortBy=${sortBy}&order=${order}`}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? "border-primary text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                }`}
                        >
                            {tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </Link>
                    ))}
                </div>

                <Card>
                    <CardContent className="p-0">
                        {logs.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground">No {statusFilter.toLowerCase()} logs found.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-muted/50">
                                            <th className="p-4 font-medium">
                                                <Link 
                                                    href={`/office/supervision-logs?tab=${activeTab.toLowerCase()}&sortBy=supervisor&order=${sortBy === 'supervisor' && order === 'asc' ? 'desc' : 'asc'}`}
                                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                                >
                                                    Supervisor
                                                    {sortBy === 'supervisor' ? (
                                                        order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                    ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                                                </Link>
                                            </th>
                                            <th className="p-4 font-medium">
                                                <Link 
                                                    href={`/office/supervision-logs?tab=${activeTab.toLowerCase()}&sortBy=student&order=${sortBy === 'student' && order === 'asc' ? 'desc' : 'asc'}`}
                                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                                >
                                                    Student
                                                    {sortBy === 'student' ? (
                                                        order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                    ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                                                </Link>
                                            </th>
                                            <th className="p-4 font-medium hidden md:table-cell">
                                                <Link 
                                                    href={`/office/supervision-logs?tab=${activeTab.toLowerCase()}&sortBy=date&order=${sortBy === 'date' && order === 'asc' ? 'desc' : 'asc'}`}
                                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                                >
                                                    Date & Time
                                                    {sortBy === 'date' ? (
                                                        order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                                                    ) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                                                </Link>
                                            </th>
                                            <th className="text-left p-4 font-medium hidden sm:table-cell">Details</th>
                                            <th className="text-left p-4 font-medium">Hours</th>
                                            <th className="text-right p-4 font-medium">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border border-primary/20">
                                                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                                {log.supervisor?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'SV'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{log.supervisor?.fullName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9 border border-secondary/20">
                                                            <AvatarFallback className="bg-secondary/10 text-secondary text-sm">
                                                                {log.student?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{log.student?.fullName}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 hidden md:table-cell">
                                                    <p className="font-medium">{format(new Date(log.date), 'MMM d, yyyy')}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(log.startTime), 'h:mm a')}</p>
                                                </td>
                                                <td className="p-4 hidden sm:table-cell">
                                                    <p className="text-sm">{log.supervisionType} • {log.setting}</p>
                                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{log.notes || 'No notes'}</p>
                                                </td>
                                                <td className="p-4">
                                                    <span className="font-bold text-lg">{Number(log.hours).toFixed(1)}</span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <ReviewSupervisionLogActions
                                                        logId={log.id}
                                                        status={log.status}
                                                        officeRole={officeRole}
                                                        logData={serialize(log)}
                                                    />
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
