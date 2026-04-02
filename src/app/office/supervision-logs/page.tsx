import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, Clock, CheckCircle, Download, ChevronUp, ChevronDown, ArrowUpDown, Search } from "lucide-react"
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
    searchParams: Promise<{ tab?: string, sortBy?: string, order?: string, search?: string }>
}) {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    const officeRole = String((session.user as any).officeRole).toUpperCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const params = await searchParams
    const activeTab = params.tab?.toUpperCase() || "PENDING"
    const validTabs = ["PENDING", "APPROVED", "REJECTED", "BILLED"]
    const statusFilter = validTabs.includes(activeTab) ? activeTab : "PENDING"
    const search = params.search || ""

    // Sorting Logic
    const sortBy = params.sortBy || "date"
    const order = params.order === "asc" ? "asc" : "desc"

    let logs: any[] = []
 
    try {
        // Build the dynamic orderBy object for Prisma
        let orderBy: any = {}
        if (sortBy === "supervisor") {
            orderBy = { supervisor: { fullName: order } }
        } else if (sortBy === "student") {
            orderBy = { student: { fullName: order } }
        } else {
            orderBy = { [sortBy]: order }
        }

        // Build the dynamic WHERE filter for Search
        const searchFilter = search ? {
            OR: [
                { student: { fullName: { contains: search, mode: 'insensitive' as any } } },
                { supervisor: { fullName: { contains: search, mode: 'insensitive' as any } } }
            ]
        } : {}

        const [supervisionLogs, independentLogs] = await Promise.all([
            prisma.supervisionHour.findMany({
                where: { 
                    status: statusFilter as any,
                    ...searchFilter
                },
                orderBy: orderBy,
                include: {
                    student: { select: { fullName: true } },
                    supervisor: { select: { fullName: true } }
                }
            }),
            prisma.independentHour.findMany({
                where: { 
                    status: statusFilter as any,
                    ...(search ? { student: { fullName: { contains: search, mode: 'insensitive' as any } } } : {})
                },
                orderBy: sortBy === 'supervisor' ? undefined : orderBy,
                include: {
                    student: { select: { fullName: true } }
                }
            })
        ])

        // Combine and tag them
        const combined = [
            ...supervisionLogs.map(l => ({ ...l, type: 'SUPERVISED' })),
            ...independentLogs.map(l => ({ 
                ...l, 
                type: 'INDEPENDENT', 
                supervisor: { fullName: 'N/A (Indep.)' },
                supervisionType: 'N/A' 
            }))
        ]

        // Manual sort only for the combined array if we are sorting by supervisor
        logs = combined
        if (sortBy === 'supervisor' || sortBy === 'student') {
            logs = combined.sort((a, b) => {
                const valA = (sortBy === 'supervisor' ? a.supervisor?.fullName : a.student?.fullName) || ""
                const valB = (sortBy === 'supervisor' ? b.supervisor?.fullName : b.student?.fullName) || ""
                return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
            })
        } else if (sortBy === 'date') {
            logs = combined.sort((a, b) => {
                const timeA = new Date(a.date).getTime()
                const timeB = new Date(b.date).getTime()
                return order === 'asc' ? timeA - timeB : timeB - timeA
            })
        }

    } catch (error) {
        console.error(`Error fetching ${statusFilter} logs:`, error)
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Review Logs</h1>
                        <p className="text-muted-foreground">Manage and archive supervision log submissions</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Search Filter */}
                        <form className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                name="search"
                                defaultValue={search}
                                placeholder="Search student or supervisor..."
                                className="pl-9 h-10 w-full sm:w-[300px] rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            {/* Hidden field to keep sorting/tab state when searching if using a simple form submit */}
                            <input type="hidden" name="tab" value={activeTab.toLowerCase()} />
                            <input type="hidden" name="sortBy" value={sortBy} />
                            <input type="hidden" name="order" value={order} />
                        </form>

                        <a href={`/api/office/supervision-logs/export?status=${statusFilter}&search=${search}`} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" className="rounded-xl h-10">
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                        </a>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
                    {validTabs.map((tab) => (
                        <Link
                            key={tab}
                            href={`/office/supervision-logs?tab=${tab.toLowerCase()}&search=${search}&sortBy=${sortBy}&order=${order}`}
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
