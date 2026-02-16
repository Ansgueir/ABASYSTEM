"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

interface TimesheetsTabProps {
    // Using any[] to allow serialized data (number instead of Decimal) without strict type conflicts
    independentHours: any[]
    supervisionHours: any[]
}

export function TimesheetsTab({ independentHours, supervisionHours }: TimesheetsTabProps) {
    // Combine and sort
    const allEntries = [
        ...independentHours.map(h => ({ ...h, type: 'INDEPENDENT' })),
        ...supervisionHours.map(h => ({ ...h, type: 'SUPERVISION' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Safe parsing of hours which might be strings, numbers, or Decimals depending on serialization
    const getHours = (h: any) => Number(h) || 0

    const totalHours = allEntries.reduce((sum, entry) => sum + getHours(entry.hours), 0)
    const restrictedHours = allEntries.filter(e => e.activityType === 'RESTRICTED').reduce((sum, entry) => sum + getHours(entry.hours), 0)
    const unrestrictedHours = allEntries.filter(e => e.activityType === 'UNRESTRICTED').reduce((sum, entry) => sum + getHours(entry.hours), 0)

    const isRestrictedAlert = restrictedHours > (totalHours * 1.0) // Placeholder logic, rule is complicated (40% of total fieldwork hours etc). 
    // Rule: "Alerta si las horas restringidas superan el 40% (BCBA)"
    // Interpreting literally: if restricted / total > 0.4
    const isAlert = totalHours > 0 && (restrictedHours / totalHours) > 0.4

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Timesheets Audit</CardTitle>
                    <CardDescription>Review logged hours and activities.</CardDescription>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                    <div className="flex flex-col items-end">
                        <span className="text-muted-foreground">Total</span>
                        <span>{totalHours.toFixed(2)} hrs</span>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <span className="text-muted-foreground">Restricted / Unrestricted</span>
                        <span className={isAlert ? "text-destructive font-bold" : "text-success"}>
                            {restrictedHours.toFixed(2)} / {unrestrictedHours.toFixed(2)}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Setting</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allEntries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No hours logged yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            allEntries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell>{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{entry.type}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{entry.activityType}</span>
                                            {/* @ts-ignore */}
                                            {entry.notes && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{entry.notes}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="capitalize">{entry.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</TableCell>
                                    <TableCell className="text-right">{getHours(entry.hours).toFixed(2)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
