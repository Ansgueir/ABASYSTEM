import DashboardLayout from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Plus, Calendar, Clock, Search, Eye } from "lucide-react"
import { Input } from "@/components/ui/input"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CreateGroupSessionDialog } from "@/components/create-group-session-dialog"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"

export default async function GroupSupervisionPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    if (role !== "office" && role !== "qa") redirect("/login")

    const supervisors = await prisma.supervisor.findMany({
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const students = await prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' }
    })

    const groupSessions = await prisma.groupSupervisionSession.findMany({
        include: {
            supervisor: true,
            attendance: {
                include: { student: true }
            }
        },
        orderBy: { date: 'desc' }
    })

    // Map properties for UI compatibility and exclude Decimal objects from the Student model
    const mappedSessions = groupSessions.map(({ attendance, supervisor, ...session }) => ({
        ...session,
        supervisor: { fullName: supervisor.fullName },
        participants: attendance.map(a => ({
            id: a.id,
            studentId: a.studentId,
            student: a.student ? { fullName: a.student.fullName } : undefined
        }))
    }))

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Group Supervision</h1>
                        <p className="text-muted-foreground">Manage group supervision sessions (max 10 students)</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search sessions..." className="pl-10" />
                        </div>
                        <CreateGroupSessionDialog supervisors={supervisors} students={students} />
                    </div>
                </div>

                {/* Sessions List */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Upcoming & Recent Sessions</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {mappedSessions.length === 0 ? (
                            <div className="text-center py-12">
                                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-muted-foreground mb-4">No group sessions scheduled</p>
                                <CreateGroupSessionDialog supervisors={supervisors} students={students} />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {mappedSessions.map((session) => (
                                    <GroupSessionDetailsDialog key={session.id} session={session} supervisors={supervisors} students={students}>
                                        <div className="cursor-pointer p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                                        <Calendar className="h-6 w-6 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium">
                                                            {session.topic || 'Group Session'}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(session.date).toLocaleDateString()}
                                                            <span>•</span>
                                                            {session.supervisor?.fullName || 'TBD'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex -space-x-2">
                                                        {session.participants?.slice(0, 4).map((p: any) => (
                                                            <Avatar key={p.id} className="h-8 w-8 border-2 border-background">
                                                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                                                    {p.student?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        ))}
                                                        {session.participants?.length > 4 && (
                                                            <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                                                                +{session.participants.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground mr-2">
                                                        {session.participants?.length || 0}/10
                                                    </span>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" asChild>
                                                        <div><Eye className="h-4 w-4" /></div>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </GroupSessionDetailsDialog>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout >
    )
}
