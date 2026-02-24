"use client"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Eye, Clock, Calendar, Users, BookOpen } from "lucide-react"
import { format } from "date-fns"

interface StudentGroupSessionDetailsProps {
    session: any // GroupSupervisionSession with supervisor and attendance included
    attended?: boolean // Optional boolean for past sessions
    isPast?: boolean
}

export function StudentGroupSessionDetails({ session, attended, isPast }: StudentGroupSessionDetailsProps) {
    if (!session) return null

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full ml-auto text-muted-foreground hover:text-foreground">
                    <div><Eye className="h-4 w-4" /></div>
                    <span className="sr-only">View Details</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Group Session Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex items-start justify-between">
                        <span className="font-semibold text-lg max-w-[80%]">{session.topic}</span>
                        {isPast && (
                            <span className={`text-xs px-2 py-1 rounded-full font-bold tracking-wider ${attended ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                                {attended ? 'ATTENDED' : 'MISSED'}
                            </span>
                        )}
                    </div>

                    <div className="space-y-4 text-sm mt-4">
                        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl">
                            <div className="space-y-1">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</span>
                                <p className="font-medium text-foreground">{format(new Date(session.date), 'MMMM d, yyyy')}</p>
                            </div>
                            <div className="space-y-1">
                                <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Time</span>
                                <p className="font-medium text-foreground">{format(new Date(session.startTime), 'h:mm a')}</p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between border-b pb-2">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <BookOpen className="h-4 w-4" /> Supervising Instructor
                                </span>
                                <span className="font-medium">{session.supervisor?.fullName || 'N/A'}</span>
                            </div>

                            <div className="flex items-center justify-between border-b pb-2">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Enrolled Students
                                </span>
                                <span className="font-medium">{session.attendance?.length || 0} / {session.maxStudents}</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <p className="text-muted-foreground text-xs leading-relaxed">
                                {isPast
                                    ? "This session has already concluded. If you missed it and believe this is an error, please contact your supervisor directly."
                                    : "You are currently enrolled in this upcoming session. Please ensure you attend the scheduled meeting right on time to receive credit."}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
