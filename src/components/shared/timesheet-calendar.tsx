"use client"

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useMemo } from 'react'
import { Badge } from "@/components/ui/badge"
import { Users } from 'lucide-react'
// Note: Some global CSS overrides will be necessary for Next.js app router and Tailwind 
// to properly style the react-big-calendar elements, but this file provides the functional calendar.

const locales = {
    'en-US': enUS,
}

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
})

interface TimesheetCalendarProps {
    hours: any[]
    onEventClick?: (hour: any) => void
    role: 'student' | 'supervisor' | 'office'
}

export function TimesheetCalendar({ hours, onEventClick, role }: TimesheetCalendarProps) {
    const events = useMemo(() => {
        return hours.map((hour: any) => {
            // Safe parsing of dates
            const start = new Date(hour.startTime || hour.date)
            // Fix any "Invalid Date"
            if (isNaN(start.getTime())) return null

            const durationMs = (Number(hour.hours) || 1) * 3600000
            const end = new Date(start.getTime() + durationMs)

            const isGroup = hour.supervisionType === 'GROUP' || hour.groupId;
            
            let title;
            if (isGroup) {
                const groupName = hour.groupName || hour.activityType || hour.group?.name || hour.session?.group?.name || "Group";
                let supName = hour.supervisor?.fullName || hour.supervisorName || hour.session?.supervisor?.fullName;
                if (!supName && role === 'office') supName = "Unassigned";
                
                title = `${groupName}`;
                if (supName) title += ` · ${supName}`;
                if (hour.groupTopic && hour.groupTopic !== title) title += ` (${hour.groupTopic})`;

            } else {
                title = hour.activityType || (hour.type === 'SUPERVISION' || hour.type === 'supervised' ? "Supervised" : "Independent");
                if (role === 'supervisor') {
                    const studentName = hour.student ? `${hour.student.firstName || ''} ${hour.student.lastName || ''}`.trim() : (hour.student?.fullName || 'Student');
                    title = `${title} (${studentName})`;
                } else if (role === 'office') {
                    const supervisorName = hour.supervisor?.fullName || 'Supervisor';
                    title = `${title} - ${supervisorName}`;
                }
            }

            return {
                id: hour.id,
                title,
                start,
                end,
                allDay: false,
                isGroup,
                resource: hour
            }
        }).filter(Boolean)
    }, [hours, role])

    const eventStyleGetter = (event: any) => {
        const resource = event.resource
        const status = resource.status?.toUpperCase() || 'PENDING'
        
        let backgroundColor = '#6366f1' // Indigo default
        if (status === 'APPROVED' || status === 'BILLED') backgroundColor = '#10b981' // success/emerald
        if (status === 'PENDING' || status === 'LOGGED') backgroundColor = '#f59e0b' // warning/amber
        if (status === 'REJECTED') backgroundColor = '#ef4444' // destructive/red
        if (status === 'GROUP' || status === 'GROUPED') backgroundColor = '#4f46e5' // Indigo-600
        if (status === 'INDEPENDENT') backgroundColor = '#8b5cf6' // Violet for independent

        return {
            style: {
                backgroundColor,
                borderRadius: '4px',
                border: '1px solid rgba(0,0,0,0.1)',
                opacity: 0.95,
                color: 'white',
                display: 'block',
                fontWeight: 600,
                fontSize: '11px',
                padding: '3px 6px',
                textShadow: '0 1px 1px rgba(0,0,0,0.2)'
            }
        }
    }

    const EventComponent = ({ event }: any) => {
        return (
            <div className="flex flex-row items-center gap-1 overflow-hidden whitespace-nowrap text-ellipsis h-full">
                {event.isGroup && <Users className="h-3 w-3 shrink-0 opacity-90" />}
                <span className="truncate">{event.title}</span>
            </div>
        )
    }

    return (
        <div className="min-h-[800px] w-full flex flex-col relative z-0">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                views={['month', 'week', 'day']}
                defaultView="month"
                onSelectEvent={(event) => onEventClick?.(event.resource)}
                eventPropGetter={eventStyleGetter}
                components={{
                    event: EventComponent
                }}
                popup={true}
                tooltipAccessor={(event: any) => `${event.title} - ${event.resource.status || 'Pending'}`}
            />
        </div>
    )
}
