"use client"

import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useMemo } from 'react'
import { Badge } from "@/components/ui/badge"
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
    role: 'student' | 'supervisor'
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

            let title = hour.activityType || (hour.type === 'SUPERVISION' || hour.type === 'supervised' ? "Supervised" : "Independent")
            if (role === 'supervisor') {
                const studentName = hour.student ? `${hour.student.firstName} ${hour.student.lastName}` : 'Student'
                title = `${title} (${studentName})`
            }

            return {
                id: hour.id,
                title,
                start,
                end,
                allDay: false,
                resource: hour
            }
        }).filter(Boolean)
    }, [hours, role])

    const eventStyleGetter = (event: any) => {
        const resource = event.resource
        const status = resource.status?.toUpperCase() || 'PENDING'
        
        let backgroundColor = 'var(--primary)'
        if (status === 'APPROVED' || status === 'BILLED') backgroundColor = '#10b981' // success/emerald
        if (status === 'PENDING' || status === 'LOGGED') backgroundColor = '#eab308' // warning/yellow
        if (status === 'REJECTED') backgroundColor = '#ef4444' // destructive/red

        return {
            style: {
                backgroundColor,
                borderRadius: '6px',
                border: 'none',
                opacity: 0.9,
                color: 'white',
                display: 'block',
                fontWeight: 500,
                fontSize: '11px',
                padding: '2px 4px'
            }
        }
    }

    return (
        <div className="h-[750px] w-full bg-card rounded-xl border border-border/50 shadow-sm p-4 overflow-hidden">
            <style jsx global>{`
                /* Tailwind integration for react-big-calendar */
                .rbc-calendar {
                    font-family: inherit;
                }
                .rbc-btn-group button {
                    color: hsl(var(--foreground));
                    border-color: hsl(var(--border) / 0.5);
                }
                .rbc-btn-group button:hover {
                    background-color: hsl(var(--accent));
                }
                .rbc-btn-group button.rbc-active {
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    box-shadow: none;
                }
                .rbc-today {
                    background-color: hsl(var(--accent) / 0.3) !important;
                }
                .rbc-header {
                    padding: 8px;
                    font-weight: 600;
                    border-bottom-color: hsl(var(--border) / 0.5) !important;
                }
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view, .rbc-header {
                    border-color: hsl(var(--border) / 0.5) !important;
                }
                .rbc-day-bg, .rbc-month-row, .rbc-time-content, .rbc-time-header-cell {
                    border-color: hsl(var(--border) / 0.5) !important;
                }
                .rbc-time-slot {
                    border-bottom-color: hsl(var(--border) / 0.2) !important;
                }
            `}</style>
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                views={['month', 'week', 'day']}
                defaultView="month"
                onSelectEvent={(event) => onEventClick?.(event.resource)}
                eventPropGetter={eventStyleGetter}
                popup={true}
                tooltipAccessor={(event: any) => `${event.title} - ${event.resource.status || 'Pending'}`}
            />
        </div>
    )
}
