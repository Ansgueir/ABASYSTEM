"use client"

import { useState, useMemo } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Calendar, List, Search, Clock, Users, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { format, addWeeks, startOfDay } from "date-fns"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const DAY_INDICES: Record<string, number> = {
    SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
    THURSDAY: 4, FRIDAY: 5, SATURDAY: 6
}

const DAY_LABELS: Record<string, string> = {
    MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
    THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun"
}

const TYPE_COLORS: Record<string, string> = {
    REGULAR: "bg-indigo-100 text-indigo-800",
    CONCENTRATED: "bg-amber-100 text-amber-800"
}

interface GroupSupervisionClientViewProps {
    officeGroups: any[]
    actualSessions: any[]
    supervisors: { id: string; fullName: string }[]
}

/**
 * Expand an OfficeGroup into virtual calendar events for the next N weeks.
 * Each event lands on the correct day-of-week at the configured time.
 */
function expandGroupToEvents(group: any, weeksAhead = 52): any[] {
    const events: any[] = []
    const targetDay = DAY_INDICES[group.dayOfWeek] ?? 1
    const [startH, startM] = String(group.startTime).split(":").map(Number)

    const today = startOfDay(new Date())
    const diff = (targetDay - today.getDay() + 7) % 7
    let cursor = new Date(today)
    cursor.setDate(cursor.getDate() + diff === 0 ? 0 : diff)

    // If the diff was 0, that's today — always include it
    for (let w = 0; w < weeksAhead; w++) {
        const eventDate = new Date(cursor)
        const startTime = new Date(cursor)
        startTime.setHours(startH, startM, 0, 0)

        const supervisorEntries: any[] = group.supervisors || []
        // One virtual event per supervisor assigned to this group
        if (supervisorEntries.length === 0) {
            // Still show the group even with no supervisors
            events.push({
                id: `virtual_${group.id}_${w}`,
                isVirtual: true,
                groupId: group.id,
                groupName: group.name,
                groupType: group.groupType,
                dayOfWeek: group.dayOfWeek,
                date: eventDate.toISOString(),
                startTime: startTime.toISOString(),
                endTime: group.endTime,
                supervisor: null,
                supervisorId: null,
                participants: [],
                maxStudents: 10,
                topic: `${group.groupType} — ${group.name}`,
                hours: 1,
                activityType: group.name,
                supervisionType: "GROUP",
                status: "GROUP"
            })
        } else {
            for (const se of supervisorEntries) {
                events.push({
                    id: `virtual_${group.id}_${se.supervisorId}_${w}`,
                    isVirtual: true,
                    groupId: group.id,
                    groupName: group.name,
                    groupType: group.groupType,
                    dayOfWeek: group.dayOfWeek,
                    date: eventDate.toISOString(),
                    startTime: startTime.toISOString(),
                    endTime: group.endTime,
                    supervisor: se.supervisor,
                    supervisorId: se.supervisorId,
                    participants: [],
                    maxStudents: 10,
                    topic: `${group.groupType} — ${group.name}`,
                    hours: 1,
                    activityType: group.name,
                    supervisionType: "GROUP",
                    status: "GROUP"
                })
            }
        }
        cursor = addWeeks(cursor, 1)
    }
    return events
}

export function GroupSupervisionClientView({ officeGroups, actualSessions, supervisors }: GroupSupervisionClientViewProps) {
    const [selectedSession, setSelectedSession] = useState<any>(null)
    const [view, setView] = useState<"calendar" | "list">("calendar")
    const [search, setSearch] = useState("")
    const [supervisorFilter, setSupervisorFilter] = useState("all")

    // Build virtual events from OfficeGroups
    const virtualEvents = useMemo(() =>
        officeGroups.flatMap(g => expandGroupToEvents(g, 52))
    , [officeGroups])

    // Merge: prefer actual sessions over virtual ones on the same day+supervisor+group
    const actualMap = useMemo(() => {
        const map = new Map<string, any>()
        for (const s of actualSessions) {
            const dateStr = new Date(s.date).toDateString()
            const key = `${s.supervisorId}_${dateStr}`
            map.set(key, s)
        }
        return map
    }, [actualSessions])

    const allEvents = useMemo(() => {
        return virtualEvents.map(ev => {
            const dateStr = new Date(ev.date).toDateString()
            const key = `${ev.supervisorId}_${dateStr}`
            const actual = actualMap.get(key)
            if (actual) {
                return {
                    ...ev,
                    id: actual.id,
                    isVirtual: false,
                    participants: (actual.attendance || []).map((a: any) => ({
                        id: a.id,
                        studentId: a.studentId,
                        student: a.student
                    }))
                }
            }
            return ev
        })
    }, [virtualEvents, actualMap])

    // Apply filters
    const filteredEvents = allEvents.filter(s => {
        const matchesSupervisor = supervisorFilter === "all" || s.supervisorId === supervisorFilter
        const matchesSearch =
            (s.topic?.toLowerCase().includes(search.toLowerCase())) ||
            (s.supervisor?.fullName?.toLowerCase().includes(search.toLowerCase())) ||
            (s.groupName?.toLowerCase().includes(search.toLowerCase()))
        return matchesSupervisor && matchesSearch
    })

    return (
        <div className="space-y-6">
            {/* Group Legend */}
            <div className="flex flex-wrap gap-2">
                {officeGroups.map(g => (
                    <div key={g.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${g.groupType === "REGULAR" ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                        <span className="h-2 w-2 rounded-full bg-current inline-block" />
                        {g.name} · {DAY_LABELS[g.dayOfWeek]} {g.startTime}–{g.endTime}
                        <Badge variant="outline" className="ml-1 text-[10px] px-1.5">{g.groupType}</Badge>
                        <span className="opacity-60">({(g.supervisors || []).length} sup)</span>
                    </div>
                ))}
                {officeGroups.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No groups configured yet. Go to Settings → Groups to create groups.</p>
                )}
            </div>

            {/* Toolbar: View Toggle + Filter + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-full sm:w-auto">
                    <TabsList className="bg-muted/50 p-1 rounded-xl">
                        <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Calendar className="h-4 w-4 mr-2" />
                            Calendar
                        </TabsTrigger>
                        <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <List className="h-4 w-4 mr-2" />
                            List
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-3">
                    {/* Supervisor Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                            <SelectTrigger className="w-48 rounded-xl h-10 bg-background">
                                <SelectValue placeholder="Filter by supervisor" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Supervisors</SelectItem>
                                {supervisors.map(sup => (
                                    <SelectItem key={sup.id} value={sup.id}>{sup.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search groups..." 
                            className="pl-10 rounded-xl" 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {view === "calendar" ? (
                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-indigo-50">
                            <TimesheetCalendar 
                                hours={filteredEvents} 
                                role="office" 
                                onEventClick={(session) => setSelectedSession(session)} 
                            />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0 space-y-4">
                        {filteredEvents.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-indigo-200">
                                <p className="text-muted-foreground">No sessions found. Configure groups in Settings → Groups and assign supervisors.</p>
                            </div>
                        ) : (
                            // Only show the next occurrence of each group×supervisor combo
                            Object.values(
                                filteredEvents.reduce((acc: any, ev: any) => {
                                    const key = `${ev.groupId}_${ev.supervisorId}`
                                    if (!acc[key] || new Date(ev.date) < new Date(acc[key].date)) {
                                        acc[key] = ev
                                    }
                                    return acc
                                }, {})
                            ).sort((a: any, b: any) => DAY_INDICES[a.dayOfWeek] - DAY_INDICES[b.dayOfWeek])
                             .map((session: any) => (
                                <GroupSessionDetailsDialog 
                                    key={session.id} 
                                    session={session} 
                                    supervisors={supervisors} 
                                    students={[]}
                                >
                                    <div className="cursor-pointer p-4 rounded-2xl bg-white border border-indigo-50 hover:border-indigo-200 hover:shadow-md transition-all text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${session.groupType === "REGULAR" ? "bg-indigo-50" : "bg-amber-50"}`}>
                                                    <Calendar className={`h-6 w-6 ${session.groupType === "REGULAR" ? "text-indigo-600" : "text-amber-600"}`} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-indigo-900">{session.groupName}</p>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {DAY_LABELS[session.dayOfWeek]} · {session.startTime?.slice(11,16) || ""}{session.endTime ? `–${session.endTime}` : ""}
                                                        <span>•</span>
                                                        <span className="text-indigo-600">{session.supervisor?.fullName || 'No supervisor'}</span>
                                                    </div>
                                                    <Badge className={`mt-1 text-[10px] ${TYPE_COLORS[session.groupType] || ""}`}>{session.groupType}</Badge>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-indigo-900">{session.participants?.length || 0}/10</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> Students
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </GroupSessionDetailsDialog>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}

            {selectedSession && (
                <GroupSessionDetailsDialog 
                    session={selectedSession} 
                    supervisors={supervisors} 
                    students={[]} 
                    open={!!selectedSession} 
                    onOpenChange={(open) => !open && setSelectedSession(null)}
                />
            )}
        </div>
    )
}
