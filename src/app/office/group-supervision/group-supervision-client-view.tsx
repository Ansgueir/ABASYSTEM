"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, List, Search, Clock, Users, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface GroupSupervisionClientViewProps {
    sessions: any[]
    supervisors: { id: string; fullName: string }[]
}

export function GroupSupervisionClientView({ sessions, supervisors }: GroupSupervisionClientViewProps) {
    const [selectedSession, setSelectedSession] = useState<any>(null)
    const [view, setView] = useState<"calendar" | "list">("calendar")
    const [search, setSearch] = useState("")
    const [supervisorFilter, setSupervisorFilter] = useState("all")

    // Apply filters
    const filteredSessions = sessions.filter(s => {
        const matchesSupervisor = supervisorFilter === "all" || s.supervisor?.id === supervisorFilter
        const matchesSearch = 
            (s.topic?.toLowerCase().includes(search.toLowerCase())) ||
            (s.supervisor?.fullName?.toLowerCase().includes(search.toLowerCase())) ||
            (s.groupName?.toLowerCase().includes(search.toLowerCase()))
        return matchesSupervisor && matchesSearch
    })

    // Map sessions for the calendar
    const calendarHours = filteredSessions.map(s => ({
        ...s,
        date: s.date,
        startTime: s.startTime,
        hours: (s.durationMin || 60) / 60,
        activityType: s.topic || s.groupName,
        supervisionType: 'GROUP',
        status: 'GROUP',
    }))

    return (
        <div className="space-y-6">
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
                            placeholder="Search sessions..." 
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
                                hours={calendarHours} 
                                role="office" 
                                onEventClick={(session) => setSelectedSession(session)} 
                            />
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-none shadow-none bg-transparent">
                    <CardContent className="p-0 space-y-4">
                        {filteredSessions.length === 0 ? (
                            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-indigo-200">
                                <p className="text-muted-foreground">No sessions found matching your filters.</p>
                            </div>
                        ) : (
                            filteredSessions.map((session) => (
                                <GroupSessionDetailsDialog 
                                    key={session.id} 
                                    session={session} 
                                    supervisors={supervisors} 
                                    students={[]}
                                >
                                    <div className="cursor-pointer p-4 rounded-2xl bg-white border border-indigo-50 hover:border-indigo-200 hover:shadow-md transition-all text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                    <Calendar className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-indigo-900">
                                                        {session.groupName || session.topic || 'Group Session'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {format(new Date(session.startTime), "p")} 
                                                        <span>•</span>
                                                        <span className="text-indigo-600">{session.supervisor?.fullName || 'TBD'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="text-xs font-bold text-indigo-900">{session.participants?.length || 0}/10</div>
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Students</div>
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
