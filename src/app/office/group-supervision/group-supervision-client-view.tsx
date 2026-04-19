"use client"

import { useState, useMemo } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, List, Search, Filter, ChevronDown, ChevronRight, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
    MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday",
    THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday"
}

interface GroupSupervisionClientViewProps {
    officeGroups: any[]
    actualSessions: any[]
    supervisors: { id: string; fullName: string }[]
}

function expandGroupToEvents(group: any, weeksAhead = 52): any[] {
    const events: any[] = []
    const targetDay = DAY_INDICES[group.dayOfWeek] ?? 1
    const [startH, startM] = String(group.startTime).split(":").map(Number)

    const today = startOfDay(new Date())
    const diff = (targetDay - today.getDay() + 7) % 7
    let cursor = new Date(today)
    cursor.setDate(cursor.getDate() + diff)

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
            events.push({ ...base, id: `virtual_${group.id}_${w}`, supervisor: null, supervisorId: null })
        } else {
            for (const se of supervisorEntries) {
                events.push({ ...base, id: `virtual_${group.id}_${se.supervisorId}_${w}`, supervisor: se.supervisor, supervisorId: se.supervisorId })
            }
        }

        cursor = addWeeks(cursor, 1)
    }
    return events
}

// ── Accordion row: one group, expandable supervisors ─────────────────────────
function GroupAccordionRow({ group, supervisorRows, supervisors, actualMap }: {
    group: any
    supervisorRows: any[]
    supervisors: any[]
    actualMap: Map<string, any>
}) {
    const [open, setOpen] = useState(false)
    const isRegular = group.groupType === "REGULAR"
    const totalStudents = supervisorRows.reduce((sum, r) => sum + (r.participants?.length || 0), 0)

    return (
        <div className={`rounded-2xl border overflow-hidden transition-all ${isRegular ? "border-indigo-100" : "border-amber-100"}`}>
            {/* Header — click to expand */}
            <button
                onClick={() => setOpen(v => !v)}
                className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${isRegular ? "bg-indigo-50/60 hover:bg-indigo-50" : "bg-amber-50/60 hover:bg-amber-50"}`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${isRegular ? "bg-indigo-500" : "bg-amber-400"}`} />
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{group.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {DAY_LABELS[group.dayOfWeek]} · {group.startTime}–{group.endTime}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Badge className={`text-[10px] px-2 ${isRegular ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}`}>
                        {isRegular ? "Regular" : "Concentrated"}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {supervisorRows.length} sup · {totalStudents} students
                    </span>
                    {open
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    }
                </div>
            </button>

            {/* Expanded: supervisor rows */}
            {open && (
                <div className="divide-y divide-gray-100 bg-white">
                    {supervisorRows.length === 0 ? (
                        <p className="px-6 py-3 text-xs text-muted-foreground italic">No supervisors assigned to this group.</p>
                    ) : (
                        supervisorRows.map((row, i) => (
                            <GroupSessionDetailsDialog
                                key={row.id}
                                session={row}
                                supervisors={supervisors}
                                students={[]}
                            >
                                <div className="cursor-pointer flex items-center justify-between px-6 py-2.5 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isRegular ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700"}`}>
                                            {(row.supervisor?.fullName || "?")[0]}
                                        </div>
                                        <span className="text-sm text-gray-800">{row.supervisor?.fullName || <em className="text-muted-foreground">Unassigned</em>}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">{row.participants?.length || 0}/10 students</span>
                                </div>
                            </GroupSessionDetailsDialog>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}

export function GroupSupervisionClientView({ officeGroups, actualSessions, supervisors }: GroupSupervisionClientViewProps) {
    const [selectedSession, setSelectedSession] = useState<any>(null)
    const [view, setView] = useState<"calendar" | "list">("list")
    const [search, setSearch] = useState("")
    const [supervisorFilter, setSupervisorFilter] = useState("all")
    const [typeFilter, setTypeFilter] = useState("all")

    const virtualEvents = useMemo(() =>
        officeGroups.flatMap(g => expandGroupToEvents(g, 52))
    , [officeGroups])

    const actualMap = useMemo(() => {
        const map = new Map<string, any>()
        for (const s of actualSessions) {
            const dateStr = new Date(s.date).toDateString()
            const key = `${s.supervisorId}_${dateStr}`
            map.set(key, s)
        }
        return map
    }, [actualSessions])

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

    const filteredEvents = allEvents.filter(s => {
        const matchesSupervisor = supervisorFilter === "all" || s.supervisorId === supervisorFilter
        const matchesType = typeFilter === "all" || s.groupType === typeFilter
        const matchesSearch =
            s.groupName?.toLowerCase().includes(search.toLowerCase()) ||
            s.supervisor?.fullName?.toLowerCase().includes(search.toLowerCase())
        return matchesSupervisor && matchesType && matchesSearch
    })

    // ── For list view: deduplicate to next occurrence per group×supervisor, then group by groupId ──
    const groupedForList = useMemo(() => {
        // Next occurrence per group×supervisor key
        const nextOccurrence: Record<string, any> = {}
        for (const ev of filteredEvents) {
            const key = `${ev.groupId}_${ev.supervisorId}`
            if (!nextOccurrence[key] || new Date(ev.date) < new Date(nextOccurrence[key].date)) {
                nextOccurrence[key] = ev
            }
        }

        // Group by groupId
        const byGroup: Record<string, { group: any; rows: any[] }> = {}
        for (const ev of Object.values(nextOccurrence)) {
            if (!byGroup[ev.groupId]) {
                const matchedGroup = officeGroups.find(g => g.id === ev.groupId)
                byGroup[ev.groupId] = { group: matchedGroup || { id: ev.groupId, name: ev.groupName, groupType: ev.groupType, dayOfWeek: ev.dayOfWeek, startTime: ev.startTime?.slice(11,16), endTime: ev.endTime }, rows: [] }
            }
            byGroup[ev.groupId].rows.push(ev)
        }

        return Object.values(byGroup).sort((a, b) => DAY_INDICES[a.group.dayOfWeek] - DAY_INDICES[b.group.dayOfWeek])
    }, [filteredEvents, officeGroups])

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-40 rounded-xl h-9 bg-background text-sm">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="REGULAR">Regular</SelectItem>
                            <SelectItem value="CONCENTRATED">Concentrated</SelectItem>
                        </SelectContent>
                    </Select>

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
                <div className="space-y-2">
                    {groupedForList.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-indigo-200">
                            <p className="text-muted-foreground text-sm">
                                {officeGroups.length === 0
                                    ? "No groups configured. Go to Settings → Groups."
                                    : "No groups match your filters."}
                            </p>
                        </div>
                    ) : (
                        groupedForList.map(({ group, rows }) => (
                            <GroupAccordionRow
                                key={group.id}
                                group={group}
                                supervisorRows={rows}
                                supervisors={supervisors}
                                actualMap={actualMap}
                            />
                        ))
                    )}
                </div>
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
