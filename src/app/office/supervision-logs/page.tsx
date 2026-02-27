import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, Clock, CheckCircle, Download } from "lucide-react"
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
    searchParams: Promise<{ tab?: string }>
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

    let logs: any[] = []

    try {
        logs = await prisma.supervisionHour.findMany({
            where: { status: statusFilter as any },
            orderBy: { date: 'asc' },
            include: {
                student: { select: { fullName: true } },
                supervisor: { select: { fullName: true } }
            }
        })
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
                    <a href={`/api/office/supervision-logs/export?status=${statusFilter}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="rounded-xl">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                    </a>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
                    {validTabs.map((tab) => (
                        <Link
                            key={tab}
                            href={`/office/supervision-logs?tab=${tab.toLowerCase()}`}
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
                                            <th className="text-left p-4 font-medium">Supervisor</th>
                                            <th className="text-left p-4 font-medium">Student</th>
                                            <th className="text-left p-4 font-medium hidden md:table-cell">Date & Time</th>
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
