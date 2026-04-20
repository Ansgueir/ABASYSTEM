"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"

export function SupervisorActivityTab({ 
    supervisionHours = [], 
    groupSessions = [] 
}: { 
    supervisionHours: any[], 
    groupSessions?: any[] 
}) {
    const [mounted, setMounted] = useState(false)
    const [userSelectedStudentId, setUserSelectedStudentId] = useState<string>("all")
    const [selectedHour, setSelectedHour] = useState<any>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="p-8 text-center text-muted-foreground">Loading activity history...</div>
    }

    const studentsMap = new Map<string, any>()
    ;(supervisionHours || []).forEach(h => {
        if (h.student && h.student.id) {
            studentsMap.set(h.student.id, h.student)
        }
    })
    const students = Array.from(studentsMap.values())

    const safeSupervision = Array.isArray(supervisionHours) ? supervisionHours : []
    const safeGroups = Array.isArray(groupSessions) ? groupSessions : []

    // Normalize group logs for visualization
    const groupLogs = safeGroups.map(s => ({
        id: s.id,
        date: s.date,
        startTime: s.startTime,
        hours: 1, // Default for group activity view
        supervisionType: 'GROUP',
        groupTopic: s.topic,
        status: 'PENDING',
        type: 'supervised',
        attendance: s.attendance,
        student: { fullName: `${s.attendance?.length || 0} Students` }
    }))

    const allCombined = [...safeSupervision, ...groupLogs]

    const filteredHours = userSelectedStudentId === "all" 
        ? allCombined 
        : (allCombined || []).filter(hour => {
            if (hour.studentId === userSelectedStudentId) return true
            // Support for group logs where studentId might be nested in attendance
            if (hour.supervisionType === 'GROUP' && hour.attendance) {
                return hour.attendance.some((att: any) => att.studentId === userSelectedStudentId)
            }
            return false
        })

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Select value={userSelectedStudentId} onValueChange={setUserSelectedStudentId}>
                    <SelectTrigger className="w-[280px] bg-background">
                        <SelectValue placeholder="Display All Students" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Display All Students</SelectItem>
                        {students.map((st: any) => (
                            <SelectItem key={st.id} value={st.id}>{st.fullName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-xl border bg-card p-6 w-full overflow-x-auto relative">
                <h3 className="font-semibold text-lg mb-4">Activity Log Calendar</h3>
                <div className="w-full relative">
                    <TimesheetCalendar 
                        hours={filteredHours} 
                        role="supervisor" 
                        onEventClick={(hour: any) => setSelectedHour(hour)} 
                    />
                </div>

                <Dialog open={!!selectedHour} onOpenChange={(open: boolean) => !open && setSelectedHour(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Activity Details</DialogTitle>
                        </DialogHeader>
                        {selectedHour && (
                            <div className="space-y-4 py-4 text-sm">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-muted-foreground text-xs">Date</p>
                                        <p className="font-medium">
                                            {format(new Date(selectedHour.date || selectedHour.startTime || new Date()), "MMMM d, yyyy")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Duration</p>
                                        <p className="font-medium">{Number(selectedHour.hours || 0).toFixed(1)} hrs</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Student</p>
                                        <p className="font-medium">{selectedHour.student?.fullName || 'Multiple Students'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">Status</p>
                                        <Badge variant={selectedHour.status === 'APPROVED' ? 'default' : selectedHour.status === 'BILLED' ? 'default' : selectedHour.status === 'REJECTED' ? 'destructive' : 'secondary'} className="mt-1">
                                            {String(selectedHour.status || "UNKNOWN")}
                                        </Badge>
                                    </div>
                                    <div className="col-span-2 border-t pt-4 mt-2">
                                        <p className="text-muted-foreground text-xs">Activity Type</p>
                                        <p className="font-medium">{String(selectedHour.activityType || 'Group Supervision').replace(/_/g, ' ')}</p>
                                    </div>
                                    {selectedHour.setting && (
                                        <div className="col-span-2">
                                            <p className="text-muted-foreground text-xs">Setting</p>
                                            <p className="font-medium">{String(selectedHour.setting).replace(/_/g, ' ')}</p>
                                        </div>
                                    )}
                                    {selectedHour.notes && (
                                        <div className="col-span-2 border-t pt-4 mt-2">
                                            <p className="text-muted-foreground text-xs">Notes</p>
                                            <p className="italic bg-muted/30 p-3 rounded-lg mt-1">{String(selectedHour.notes)}</p>
                                        </div>
                                    )}
                                    {selectedHour.groupTopic && (
                                        <div className="col-span-2 border-t pt-4 mt-2">
                                            <p className="text-muted-foreground text-xs">Group Topic</p>
                                            <p className="font-medium">{String(selectedHour.groupTopic)}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
