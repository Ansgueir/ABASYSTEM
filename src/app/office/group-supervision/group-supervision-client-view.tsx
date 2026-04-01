"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { GroupSessionDetailsDialog } from "@/components/group-session-details-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, List, Search, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface GroupSupervisionClientViewProps {
    sessions: any[]
    supervisors: any[]
    students: any[]
}

export function GroupSupervisionClientView({ sessions, supervisors, students }: GroupSupervisionClientViewProps) {
    const [selectedSession, setSelectedSession] = useState<any>(null)
    const [view, setView] = useState<"calendar" | "list">("calendar")
    const [search, setSearch] = useState("")

    const filteredSessions = sessions.filter(s => 
        (s.topic?.toLowerCase().includes(search.toLowerCase())) ||
        (s.supervisor?.fullName?.toLowerCase().includes(search.toLowerCase()))
    )

    // Map sessions for the calendar
    const calendarHours = sessions.map(s => ({
        ...s,
        date: s.date,
        startTime: s.startTime,
        hours: (s.durationMin || 60) / 60,
        activityType: s.topic,
        status: 'GROUP', // Custom status that will default to primary color
    }))

    return (
        <div className="space-y-6">
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
                                <p className="text-muted-foreground">No sessions found matching your search.</p>
                            </div>
                        ) : (
                            filteredSessions.map((session) => (
                                <GroupSessionDetailsDialog 
                                    key={session.id} 
                                    session={session} 
                                    supervisors={supervisors} 
                                    students={students}
                                >
                                    <div className="cursor-pointer p-4 rounded-2xl bg-white border border-indigo-50 hover:border-indigo-200 hover:shadow-md transition-all text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                    <Calendar className="h-6 w-6 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-indigo-900">
                                                        {session.topic || 'Group Session'}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                        <Clock className="h-3.3 w-3.5" />
                                                        {format(new Date(session.startTime), "p")} 
                                                        <span>•</span>
                                                        <span className="text-indigo-600">{session.supervisor?.fullName || 'TBD'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex -space-x-3">
                                                    {session.participants?.slice(0, 4).map((p: any) => (
                                                        <Avatar key={p.id} className="h-8 w-8 border-2 border-white shadow-sm">
                                                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                                                {p.student?.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                    {session.participants?.length > 4 && (
                                                        <div className="h-8 w-8 rounded-full bg-indigo-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-indigo-600 shadow-sm">
                                                            +{session.participants.length - 4}
                                                        </div>
                                                    )}
                                                </div>
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
                    students={students} 
                    open={!!selectedSession} 
                    onOpenChange={(open) => !open && setSelectedSession(null)}
                />
            )}
        </div>
    )
}
