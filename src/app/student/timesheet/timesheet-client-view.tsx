"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { CalendarStudentHourModal } from "@/components/student/calendar-student-hour-modal"

export function TimesheetClientView({ hours }: { hours: any[] }) {
    const [selectedHour, setSelectedHour] = useState<any>(null)

    return (
        <div className="space-y-4">
            <TimesheetCalendar 
                hours={hours} 
                role="student" 
                onEventClick={(hour) => setSelectedHour(hour)} 
            />
            {selectedHour && (
                <CalendarStudentHourModal 
                    hour={selectedHour} 
                    open={!!selectedHour} 
                    onOpenChange={(open) => !open && setSelectedHour(null)} 
                />
            )}
        </div>
    )
}
