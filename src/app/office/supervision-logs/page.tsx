import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, Clock, CheckCircle } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReviewSupervisionLogActions } from "@/components/office/review-supervision-log-actions"

export default async function SupervisionLogsReviewPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    let pendingLogs: any[] = []

    try {
        pendingLogs = await prisma.supervisionHour.findMany({
            where: { status: "PENDING" },
            orderBy: { date: 'asc' },
            include: {
                student: { select: { fullName: true } },
                supervisor: { select: { fullName: true } }
            }
        })
    } catch (error) {
        console.error("Error fetching pending logs:", error)
    }

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Review Logs</h1>
                        <p className="text-muted-foreground">Approve or reject pending supervision hours</p>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0">
                        {pendingLogs.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="h-12 w-12 mx-auto text-success/50 mb-4" />
                                <p className="text-muted-foreground">All caught up! No pending logs to review.</p>
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
                                        {pendingLogs.map((log) => (
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
                                                    <ReviewSupervisionLogActions logId={log.id} />
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
