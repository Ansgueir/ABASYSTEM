"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Clock, Calendar, FileText, Tag, MapPin, Check, X } from "lucide-react"
import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { CalendarSupervisorHourModal } from "@/components/supervisor/calendar-supervisor-hour-modal"
import { updateLogStatus } from "@/actions/log-hours"

export function SupervisorTimesheetClientView({ hours, students }: { hours: any[], students: any[] }) {
    const [selectedEntry, setSelectedEntry] = useState<any>(null)
    const [userSelectedStudentId, setUserSelectedStudentId] = useState<string>("all")
    
    // Status update logic now uses a Server Action
    const [isUpdating, setIsUpdating] = useState(false)
    const [rejectReason, setRejectReason] = useState("")
    const [showRejectInput, setShowRejectInput] = useState(false)

    const handleUpdateStatus = async (id: string, type: string, status: "APPROVED" | "REJECTED") => {
        setIsUpdating(true)
        try {
            const res = await updateLogStatus(id, type, status, status === "REJECTED" ? rejectReason : undefined)
            
            if (res.error) throw new Error(res.error)
            
            toast.success(`Entry ${status.toLowerCase()} successfully`)
            window.location.reload()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Failed to update status")
        } finally {
            setIsUpdating(false)
        }
    }

    const filteredHours = userSelectedStudentId === "all" 
        ? hours 
        : hours.filter(h => h.studentId === userSelectedStudentId)
        
    const getHours = (h: any) => Number(h.hours) || 0

    return (
        <div className="space-y-6">
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

            <div className="w-full flex justify-center items-center">
                <div className="w-full relative">
                    <TimesheetCalendar 
                        hours={filteredHours} 
                        role="supervisor" 
                        onEventClick={setSelectedEntry} 
                    />
                </div>
            </div>

            <CalendarSupervisorHourModal
                hour={selectedEntry}
                open={!!selectedEntry}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedEntry(null)
                    }
                }}
                onStatusUpdate={handleUpdateStatus}
                isUpdatingStatus={isUpdating}
            />
        </div>
    )
}
