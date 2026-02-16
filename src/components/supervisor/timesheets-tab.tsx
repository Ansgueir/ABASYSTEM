"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Eye, Clock, Calendar, FileText, MapPin, Tag } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
} from "@/components/ui/dialog"

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

    // Rule: "Alerta si las horas restringidas superan el 40% (BCBA)"
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
                            <TableHead>Logged At</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Activity</TableHead>
                            <TableHead>Setting</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead className="text-right w-[80px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allEntries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No hours logged yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            allEntries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{format(new Date(entry.date), "MMM d, yyyy")}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {format(new Date(entry.createdAt), "MMM d, HH:mm")}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{entry.activityType}</span>
                                            {/* @ts-ignore */}
                                            {entry.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{entry.notes}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm capitalize">{entry.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-mono">{getHours(entry.hours).toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-md">
                                                <DialogHeader>
                                                    <DialogTitle className="flex items-center gap-2">
                                                        <FileText className="h-5 w-5 text-primary" />
                                                        Activity Details
                                                    </DialogTitle>
                                                    <DialogDescription>
                                                        Review full entry details for compliance auditing.
                                                    </DialogDescription>
                                                </DialogHeader>

                                                <div className="grid gap-4 py-4">
                                                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border">
                                                        <div className="bg-background p-2 rounded-md shadow-sm">
                                                            <Calendar className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Execution Date</p>
                                                            <p className="text-sm font-semibold">{format(new Date(entry.date), "EEEE, MMMM do, yyyy")}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 rounded-lg border bg-card">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Clock className="h-3 w-3 text-muted-foreground" />
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Logged At</span>
                                                            </div>
                                                            <p className="text-xs font-semibold">{format(new Date(entry.createdAt), "MMM d, yyyy • HH:mm")}</p>
                                                        </div>
                                                        <div className="p-3 rounded-lg border bg-card text-right">
                                                            <div className="flex items-center justify-end gap-2 mb-1">
                                                                <span className="text-[10px] uppercase font-bold text-muted-foreground">Duration</span>
                                                                <Tag className="h-3 w-3 text-muted-foreground" />
                                                            </div>
                                                            <p className="text-sm font-bold text-primary">{getHours(entry.hours).toFixed(2)} hours</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Type</p>
                                                                <Badge variant="secondary" className="font-mono text-[10px]">{entry.type}</Badge>
                                                            </div>
                                                            <div className="space-y-1 text-right">
                                                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Category</p>
                                                                <Badge variant={entry.activityType === 'RESTRICTED' ? 'destructive' : 'default'} className="text-[10px]">
                                                                    {entry.activityType}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Setting</p>
                                                            <div className="flex items-center gap-2 text-sm font-medium">
                                                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                                                <span className="capitalize">{entry.setting?.toLowerCase().replace(/_/g, ' ') || 'N/A'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Notes / Description</p>
                                                            <div className="p-4 rounded-lg bg-muted text-sm leading-relaxed border italic text-muted-foreground">
                                                                {/* @ts-ignore */}
                                                                {entry.notes || "No additional description provided."}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
