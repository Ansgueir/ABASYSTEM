"use client"

import { useState, useMemo } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, List, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { addWeeks, startOfDay } from "date-fns"
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

interface GroupSupervisionClientViewProps {
    officeGroups: any[]
    actualSessions: any[]
    supervisors: { id: string; fullName: string }[]
}

/**
 * Expand an OfficeGroup into virtual calendar events for the next N weeks.
 * Uses correct operator precedence for day-of-week calculation.
 */
function expandGroupToEvents(group: any, weeksAhead = 52): any[] {
    const events: any[] = []
    const targetDay = DAY_INDICES[group.dayOfWeek] ?? 1
    const [startH, startM] = String(group.startTime).split(":").map(Number)

    const today = startOfDay(new Date())
    // FIX: wrap diff computation in parens so setDate receives the right value
    const diff = (targetDay - today.getDay() + 7) % 7
    let cursor = new Date(today)
    cursor.setDate(cursor.getDate() + diff)  // ← correct: always add diff (0-6 days)

    const supervisorEntries: any[] = group.supervisors || []

    for (let w = 0; w < weeksAhead; w++) {
        const eventDate = new Date(cursor)
        const startTime = new Date(cursor)
        startTime.setHours(startH, startM, 0, 0)

        const base = {
            isVirtual: true,
            groupId: group.id,
            groupName: group.name,
            groupType: group.groupType,
            dayOfWeek: group.dayOfWeek,
            date: eventDate.toISOString(),
            startTime: startTime.toISOString(),
            endTime: group.endTime,
            participants: [],
            maxStudents: 10,
            topic: `${group.groupType === "REGULAR" ? "Regular" : "Concentrated"} — ${group.name}`,
            hours: 1,
            activityType: group.name,
            supervisionType: "GROUP",
            status: "GROUP"
        }

        if (supervisorEntries.length === 0) {
            events.push({
                ...base,
                id: `virtual_${group.id}_${w}`,
                supervisor: null,
                supervisorId: null,
            })
        } else {
            for (const se of supervisorEntries) {
                events.push({
                    ...base,
                    id: `virtual_${group.id}_${se.supervisorId}_${w}`,
                    supervisor: se.supervisor,
                    supervisorId: se.supervisorId,
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
    const [typeFilter, setTypeFilter] = useState("all") // "all" | "REGULAR" | "CONCENTRATED"

    // Build virtual events from OfficeGroups
    const virtualEvents = useMemo(() =>
        officeGroups.flatMap(g => expandGroupToEvents(g, 52))
    , [officeGroups])

    // Build lookup: actual sessions by supervisorId + date-string
    const actualMap = useMemo(() => {
        const map = new Map<string, any>()
        for (const s of actualSessions) {
            const dateStr = new Date(s.date).toDateString()
            const key = `${s.supervisorId}_${dateStr}`
            map.set(key, s)
        }
        return map
    }, [actualSessions])

    // Merge virtual with actual attendance data
    const allEvents = useMemo(() =>
        virtualEvents.map(ev => {
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
    , [virtualEvents, actualMap])

    // Apply filters
    const filteredEvents = allEvents.filter(s => {
        const matchesSupervisor = supervisorFilter === "all" || s.supervisorId === supervisorFilter
        const matchesType = typeFilter === "all" || s.groupType === typeFilter
        const matchesSearch =
            (s.topic?.toLowerCase().includes(search.toLowerCase())) ||
            (s.supervisor?.fullName?.toLowerCase().includes(search.toLowerCase())) ||
            (s.groupName?.toLowerCase().includes(search.toLowerCase()))
        return matchesSupervisor && matchesType && matchesSearch
    })

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* View Toggle */}
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

                <div className="flex flex-wrap items-center gap-2">
                    {/* Type Filter */}
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-40 rounded-xl h-9 bg-background text-sm">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="REGULAR">Regular</SelectItem>
                            <SelectItem value="CONCENTRATED">Concentrated</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Supervisor Filter */}
                    <div className="flex items-center gap-1.5">
                        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                            <SelectTrigger className="w-44 rounded-xl h-9 bg-background text-sm">
                                <SelectValue placeholder="All Supervisors" />
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
                    <div className="relative w-full sm:w-52">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search groups..."
                            className="pl-9 rounded-xl h-9 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Calendar / List */}
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
                    <CardContent className="p-0 space-y-3">
                        {filteredEvents.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-indigo-200">
                                <p className="text-muted-foreground text-sm">
                                    {officeGroups.length === 0
                                        ? "No groups configured. Go to Settings → Groups."
                                        : "No sessions match your filters."}
                                </p>
                            </div>
                        ) : (
                            // Deduplicate: one row per group×supervisor combo, next occurrence only
                            (Object.values(
                                filteredEvents.reduce((acc: any, ev: any) => {
                                    const key = `${ev.groupId}_${ev.supervisorId}`
                                    if (!acc[key] || new Date(ev.date) < new Date(acc[key].date)) {
                                        acc[key] = ev
                                    }
                                    return acc
                                }, {})
                            ) as any[])
                                .sort((a: any, b: any) => DAY_INDICES[a.dayOfWeek] - DAY_INDICES[b.dayOfWeek])
                                .map((session: any) => (
                                    <GroupSessionDetailsDialog
                                        key={session.id}
                                        session={session}
                                        supervisors={supervisors}
                                        students={[]}
                                    >
                                        <div className="cursor-pointer px-5 py-3.5 rounded-2xl bg-white border border-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${session.groupType === "REGULAR" ? "bg-indigo-500" : "bg-amber-400"}`} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-indigo-900 truncate">{session.groupName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {DAY_LABELS[session.dayOfWeek]} · {session.startTime?.slice(11,16)}{session.endTime ? `–${session.endTime}` : ""} · {session.supervisor?.fullName || "No supervisor"}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 text-right">
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${session.groupType === "REGULAR" ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                                    {session.groupType === "REGULAR" ? "Regular" : "Concentrated"}
                                                </span>
                                                <span className="text-xs font-bold text-indigo-900">{session.participants?.length || 0}/10</span>
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
