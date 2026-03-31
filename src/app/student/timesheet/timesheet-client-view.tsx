"use client"

import { useState } from "react"
import { TimesheetCalendar } from "@/components/shared/timesheet-calendar"
import { CalendarStudentHourModal } from "@/components/student/calendar-student-hour-modal"
import { Card, CardContent } from "@/components/ui/card"

export function TimesheetClientView({ hours }: { hours: any[] }) {
    const [selectedHour, setSelectedHour] = useState<any>(null)

    return (
        <Card className="border shadow-sm">
            <CardContent className="p-6 flex flex-col relative">
                <TimesheetCalendar 
                    hours={hours} 
                    role="student" 
                    onEventClick={(hour) => setSelectedHour(hour)} 
                />
            </CardContent>
            {selectedHour && (
                <CalendarStudentHourModal 
                    hour={selectedHour} 
                    open={!!selectedHour} 
                    onOpenChange={(open) => !open && setSelectedHour(null)} 
                />
            )}
        </Card>
    )
}
