"use client"

import { EditNotesDialog } from "@/components/supervisor/edit-notes-dialog"

interface SupervisorNotesCardProps {
    studentId: string
    notes: string | null
    canEdit: boolean
}

export function SupervisorNotesCard({ studentId, notes, canEdit }: SupervisorNotesCardProps) {
    return (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-yellow-500" />
                    <h3 className="font-semibold text-lg">Supervisor Notes</h3>
                </div>
                {canEdit && <EditNotesDialog studentId={studentId} initialNotes={notes || ""} />}
            </div>
            <div className="p-4 rounded-lg bg-yellow-50/50 border border-yellow-100 min-h-[150px] shadow-inner">
                {notes ? (
                    <p className="text-sm text-yellow-900 leading-relaxed whitespace-pre-wrap">
                        {notes}
                    </p>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-6">
                        <p className="text-sm text-yellow-700/60 italic">
                            No additional notes have been registered for this student.
                        </p>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground italic text-right mt-2">
                * These notes are private. Only Supervisors and Office staff can see this information.
            </p>
        </div>
    )
}
