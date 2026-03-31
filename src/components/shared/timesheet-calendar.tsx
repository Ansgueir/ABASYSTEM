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

    return (
        <div className="min-h-[800px] w-full flex flex-col relative z-0">
            <style jsx global>{`
                /* Modern Tailwind / Shadcn integration for react-big-calendar */
                .rbc-calendar {
                    font-family: inherit;
                    min-height: 800px;
                }
                .rbc-toolbar {
                    margin-bottom: 24px !important;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .rbc-toolbar-label {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: hsl(var(--foreground));
                }
                .rbc-btn-group {
                    display: inline-flex;
                    border-radius: 0.5rem;
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                }
                .rbc-btn-group button {
                    color: hsl(var(--foreground));
                    border-color: hsl(var(--border));
                    background-color: transparent;
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .rbc-btn-group button:hover {
                    background-color: hsl(var(--accent));
                    color: hsl(var(--accent-foreground));
                }
                .rbc-btn-group button.rbc-active {
                    background-color: hsl(var(--primary));
                    color: hsl(var(--primary-foreground));
                    box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
                    border-color: hsl(var(--primary));
                    z-index: 10;
                }
                /* Border Radius trick for the button groups */
                .rbc-btn-group button:first-child {
                    border-top-left-radius: 0.5rem;
                    border-bottom-left-radius: 0.5rem;
                }
                .rbc-btn-group button:last-child {
                    border-top-right-radius: 0.5rem;
                    border-bottom-right-radius: 0.5rem;
                }
                .rbc-btn-group button + button {
                    margin-left: -1px;
                }

                .rbc-today {
                    background-color: hsl(var(--accent) / 0.4) !important;
                }
                .rbc-header {
                    padding: 12px 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.75rem;
                    letter-spacing: 0.05em;
                    color: hsl(var(--muted-foreground));
                    border-bottom: 2px solid hsl(var(--border)) !important;
                }
                
                /* Grid borders */
                .rbc-month-view, .rbc-time-view, .rbc-agenda-view {
                    border: 1px solid hsl(var(--border)) !important;
                    border-radius: 0.5rem;
                    overflow: hidden;
                    box-shadow: 0 0 0 1px hsl(var(--border));
                }
                .rbc-day-bg, .rbc-month-row, .rbc-time-content, .rbc-time-header-cell {
                    border-color: hsl(var(--border)) !important;
                }
                .rbc-time-slot {
                    border-bottom-color: hsl(var(--border) / 0.3) !important;
                }
                .rbc-event {
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.1);
                    transition: transform 0.1s;
                }
                .rbc-event:hover {
                    transform: scale(1.02);
                    z-index: 20 !important;
                }
                .rbc-show-more {
                    color: hsl(var(--primary));
                    font-weight: 600;
                    font-size: 0.75rem;
                    background: transparent !important;
                    padding: 4px;
                }
                .rbc-show-more:hover {
                    text-decoration: underline;
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
