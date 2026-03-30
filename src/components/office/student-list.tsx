"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GraduationCap, Search, Download, Eye, Filter, X, ChevronRight, CalendarIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddStudentDialog } from "@/components/office/add-student-dialog"
import { Badge } from "@/components/ui/badge"
import { UserActions } from "@/components/office/user-actions"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { format, isWithinInterval, parseISO } from "date-fns"
import * as XLSX from "xlsx"

interface StudentListProps {
    initialStudents: any[]
    isSuperAdmin: boolean
    isQaSuper?: boolean
}

export function StudentList({ initialStudents, isSuperAdmin, isQaSuper = false }: StudentListProps) {
    const [searchTerm, setSearchTerm] = useState("")

    // Advanced Filters State
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [supervisorFilter, setSupervisorFilter] = useState<string[]>([])
    const [startDateRange, setStartDateRange] = useState<{ from?: string, to?: string }>({})
    const [endDateRange, setEndDateRange] = useState<{ from?: string, to?: string }>({})
    const [lastActivityRange, setLastActivityRange] = useState<{ from?: string, to?: string }>({})
    const [institutionFilter, setInstitutionFilter] = useState<string[]>([])
    const [degreeFilter, setDegreeFilter] = useState<string[]>([])
    const [activityFilter, setActivityFilter] = useState<"all" | "yes" | "no">("all")
    const [financeFilter, setFinanceFilter] = useState<"all" | "pending" | "paid">("all")
    const [documentFilter, setDocumentFilter] = useState<string[]>([])

    const uniqueSupervisors = useMemo(() => {
        const map = new Map()
        initialStudents.forEach(s => {
            const sups = s.supervisors || (s.supervisor ? [{ supervisor: s.supervisor }] : [])
            sups.forEach((m: any) => {
                if (m.supervisor) map.set(m.supervisor.id, m.supervisor.fullName)
            })
        })
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
    }, [initialStudents])

    const uniqueInstitutions = useMemo(() => {
        const set = new Set(initialStudents.map(s => s.school).filter(Boolean))
        return Array.from(set) as string[]
    }, [initialStudents])

    const uniqueDegrees = useMemo(() => {
        const set = new Set(initialStudents.map(s => s.academicDegree || s.credential).filter(Boolean))
        return Array.from(set) as string[]
    }, [initialStudents])

    const uniqueDocumentTypes = useMemo(() => {
        const set = new Set(initialStudents.flatMap(s => s.documents?.map((d: any) => d.documentType)).filter(Boolean))
        return Array.from(set) as string[]
    }, [initialStudents])

    // Filter logic
    const filteredStudents = useMemo(() => {
        return initialStudents.filter(student => {
            const matchesSearch =
                student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.bacbId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.supervisors?.some((s: any) => s.supervisor.fullName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                student.supervisor?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())

            // Status Map
            const derivedStatus = !student.user?.isActive ? 'INACTIVE' : (student.status || 'PENDING')
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(derivedStatus.toUpperCase())

            // Supervisor Match - Check if any assigned supervisor matches
            const studentSupervisorIds = student.supervisors?.map((s: any) => s.supervisorId) || (student.supervisorId ? [student.supervisorId] : [])
            const matchesSupervisor = supervisorFilter.length === 0 || 
                studentSupervisorIds.some((id: string) => supervisorFilter.includes(id)) ||
                (supervisorFilter.includes("unassigned") && studentSupervisorIds.length === 0)

            // Start Date
            let matchesStartDate = false
            if (!startDateRange.from && !startDateRange.to) matchesStartDate = true
            else if (student.startDate) {
                const sDate = new Date(student.startDate)
                const isAfterFrom = !startDateRange.from || sDate >= new Date(startDateRange.from)
                const isBeforeTo = !startDateRange.to || sDate <= new Date(startDateRange.to)
                matchesStartDate = isAfterFrom && isBeforeTo
            }

            // End Date
            let matchesEndDate = false
            if (!endDateRange.from && !endDateRange.to) matchesEndDate = true
            else if (student.endDate) {
                const eDate = new Date(student.endDate)
                const isAfterFrom = !endDateRange.from || eDate >= new Date(endDateRange.from)
                const isBeforeTo = !endDateRange.to || eDate <= new Date(endDateRange.to)
                matchesEndDate = isAfterFrom && isBeforeTo
            }

            // Last Activity
            let matchesLastActivity = false
            if (!lastActivityRange.from && !lastActivityRange.to) matchesLastActivity = true
            else {
                const lastActivityDate = student.supervisionHours?.[0]?.date ? new Date(student.supervisionHours[0].date) : null
                if (lastActivityDate) {
                    const isAfterFrom = !lastActivityRange.from || lastActivityDate >= new Date(lastActivityRange.from)
                    const isBeforeTo = !lastActivityRange.to || lastActivityDate <= new Date(lastActivityRange.to)
                    matchesLastActivity = isAfterFrom && isBeforeTo
                }
            }

            // Institution
            const matchesInstitution = institutionFilter.length === 0 || institutionFilter.includes(student.school)

            // Degree
            const stdDegree = student.academicDegree || student.credential
            const matchesDegree = degreeFilter.length === 0 || degreeFilter.includes(stdDegree)

            // Activity (Current month)
            let matchesActivity = true
            if (activityFilter !== "all") {
                const now = new Date()
                const hasCurrentMonthHours = student.supervisionHours?.some((h: any) => {
                    if (!h.date) return false
                    const d = new Date(h.date)
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                })
                if (activityFilter === "yes") matchesActivity = Boolean(hasCurrentMonthHours)
                if (activityFilter === "no") matchesActivity = !hasCurrentMonthHours
            }

            // Finances
            let matchesFinance = true
            if (financeFilter !== "all") {
                const pending = student.invoices?.some((i: any) => i.status === 'SENT' || i.status === 'PARTIAL' || i.status === 'OVERDUE')
                if (financeFilter === "pending") matchesFinance = pending
                if (financeFilter === "paid") matchesFinance = !pending && student.invoices?.some((i: any) => i.status === 'PAID')
            }

            // Documents
            let matchesDocuments = true
            if (documentFilter.length > 0) {
                matchesDocuments = documentFilter.every(docType =>
                    student.documents?.some((d: any) => d.documentType === docType)
                )
            }

            return matchesSearch && matchesStatus && matchesSupervisor && matchesStartDate && matchesEndDate &&
                matchesLastActivity && matchesInstitution && matchesDegree && matchesActivity && matchesFinance && matchesDocuments
        })
    }, [initialStudents, searchTerm, statusFilter, supervisorFilter, startDateRange, endDateRange, lastActivityRange, institutionFilter, degreeFilter, activityFilter, financeFilter, documentFilter])

    const activeFiltersCount =
        statusFilter.length + supervisorFilter.length + institutionFilter.length + degreeFilter.length + documentFilter.length +
        (startDateRange.from || startDateRange.to ? 1 : 0) +
        (endDateRange.from || endDateRange.to ? 1 : 0) +
        (lastActivityRange.from || lastActivityRange.to ? 1 : 0) +
        (activityFilter !== 'all' ? 1 : 0) + (financeFilter !== 'all' ? 1 : 0)

    const clearFilters = () => {
        setStatusFilter([])
        setSupervisorFilter([])
        setStartDateRange({})
        setEndDateRange({})
        setLastActivityRange({})
        setInstitutionFilter([])
        setDegreeFilter([])
        setActivityFilter("all")
        setFinanceFilter("all")
        setDocumentFilter([])
    }

    const handleExport = (format: "xlsx" | "csv") => {
        const exportData = filteredStudents.map(s => {
            const lastActivity = s.supervisionHours?.[0]?.date ? new Date(s.supervisionHours[0].date).toLocaleDateString() : 'No activity'
            const pendingInvoices = s.invoices?.filter((i: any) => i.status !== 'PAID').length || 0

            return {
                Name: s.fullName,
                Email: s.email || 'No email',
                "Assigned Supervisor": s.supervisor?.fullName || 'Not assigned',
                "BACB ID": s.bacbId || '-',
                Status: !s.user?.isActive ? 'INACTIVE' : (s.status || 'PENDING'),
                "Start Date": s.startDate ? new Date(s.startDate).toLocaleDateString() : '-',
                "End Date": s.endDate ? new Date(s.endDate).toLocaleDateString() : '-',
                Organization: s.school || '-',
                "Last Activity": lastActivity,
                "Pending Invoices": pendingInvoices
            }
        })

        const ws = XLSX.utils.json_to_sheet(exportData)
        ws['!cols'] = [
            { wch: 25 }, { wch: 30 }, { wch: 25 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
            { wch: 15 }, { wch: 15 }
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Students")
        XLSX.writeFile(wb, `Student_Export.${format}`)
    }

    const toggleArrayFilter = (state: string[], setState: any, val: string) => {
        setState(state.includes(val) ? state.filter(x => x !== val) : [...state, val])
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Students</h1>
                    <p className="text-muted-foreground">Manage all registered students</p>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, or supervisor..."
                            className="pl-10 rounded-xl w-full"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="rounded-xl gap-2 relative border-dashed border-2">
                                    <Filter className="h-4 w-4" />
                                    <span className="hidden sm:inline">Filters</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                                <SheetHeader className="mb-6">
                                    <div className="flex justify-between items-center">
                                        <SheetTitle className="text-xl font-bold">Advanced Filters</SheetTitle>
                                        {activeFiltersCount > 0 && (
                                            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                                                Clear All
                                            </Button>
                                        )}
                                    </div>
                                    <SheetDescription>
                                        Narrow down the student list by applying one or more filters below.
                                    </SheetDescription>
                                </SheetHeader>

                                <div className="space-y-8 pb-12">
                                    {/* Status */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Status</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {['ACTIVE', 'PENDING', 'INACTIVE'].map(status => (
                                                <Button
                                                    key={status}
                                                    variant={statusFilter.includes(status) ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => toggleArrayFilter(statusFilter, setStatusFilter, status)}
                                                    className="rounded-full"
                                                >
                                                    {status}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Supervisors */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Assigned Supervisor</h4>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="sv-unassigned"
                                                    checked={supervisorFilter.includes("unassigned")}
                                                    onCheckedChange={() => toggleArrayFilter(supervisorFilter, setSupervisorFilter, "unassigned")}
                                                />
                                                <label htmlFor="sv-unassigned" className="text-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis">Not Assigned</label>
                                            </div>
                                            {uniqueSupervisors.map(sv => (
                                                <div key={sv.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`sv-${sv.id}`}
                                                        checked={supervisorFilter.includes(sv.id)}
                                                        onCheckedChange={() => toggleArrayFilter(supervisorFilter, setSupervisorFilter, sv.id)}
                                                    />
                                                    <label htmlFor={`sv-${sv.id}`} className="text-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis" title={sv.name}>{sv.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Current Activity */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Has Logged Hours This Month?</h4>
                                        <div className="flex gap-2">
                                            {[
                                                { value: 'all', label: 'Any' },
                                                { value: 'yes', label: 'Yes' },
                                                { value: 'no', label: 'No' }
                                            ].map(opt => (
                                                <Button
                                                    key={opt.value}
                                                    variant={activityFilter === opt.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setActivityFilter(opt.value as any)}
                                                    className="rounded-full"
                                                >
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Finances */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Finances (Invoices)</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 'all', label: 'Any Status' },
                                                { value: 'pending', label: 'Has Pending/Overdue' },
                                                { value: 'paid', label: 'All Paid' }
                                            ].map(opt => (
                                                <Button
                                                    key={opt.value}
                                                    variant={financeFilter === opt.value ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => setFinanceFilter(opt.value as any)}
                                                    className="rounded-full"
                                                >
                                                    {opt.label}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dates Ranges */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-semibold text-sm text-primary">Date Constraints</h4>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Start Date (From)</Label>
                                                <Input type="date" value={startDateRange.from || ''} onChange={e => setStartDateRange({ ...startDateRange, from: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Start Date (To)</Label>
                                                <Input type="date" value={startDateRange.to || ''} onChange={e => setStartDateRange({ ...startDateRange, to: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">End Date (From)</Label>
                                                <Input type="date" value={endDateRange.from || ''} onChange={e => setEndDateRange({ ...endDateRange, from: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">End Date (To)</Label>
                                                <Input type="date" value={endDateRange.to || ''} onChange={e => setEndDateRange({ ...endDateRange, to: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Last Activity (From)</Label>
                                                <Input type="date" value={lastActivityRange.from || ''} onChange={e => setLastActivityRange({ ...lastActivityRange, from: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Last Activity (To)</Label>
                                                <Input type="date" value={lastActivityRange.to || ''} onChange={e => setLastActivityRange({ ...lastActivityRange, to: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Academic & Institution */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-sm">School / Organization</h4>
                                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                                {uniqueInstitutions.map(inst => (
                                                    <Button
                                                        key={inst}
                                                        variant={institutionFilter.includes(inst) ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleArrayFilter(institutionFilter, setInstitutionFilter, inst)}
                                                        className="rounded-full"
                                                    >
                                                        {inst}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-sm">Academic Degree</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {uniqueDegrees.map(deg => (
                                                    <Button
                                                        key={deg}
                                                        variant={degreeFilter.includes(deg) ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => toggleArrayFilter(degreeFilter, setDegreeFilter, deg)}
                                                        className="rounded-full"
                                                    >
                                                        {deg}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="font-semibold text-sm">Required Documents</h4>
                                            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                                                {uniqueDocumentTypes.map(doc => (
                                                    <div key={doc} className="flex items-center space-x-2">
                                                        <Checkbox
                                                            id={`doc-${doc}`}
                                                            checked={documentFilter.includes(doc)}
                                                            onCheckedChange={() => toggleArrayFilter(documentFilter, setDocumentFilter, doc)}
                                                        />
                                                        <label htmlFor={`doc-${doc}`} className="text-sm cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis capitalize" title={doc}>
                                                            {doc.replace(/_/g, ' ')}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="default" className="rounded-xl gap-2 font-medium">
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Export Results</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                                    Export as Excel (.xlsx)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExport("csv")}>
                                    Export as CSV (.csv)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AddStudentDialog isSuperAdmin={isSuperAdmin} />
                    </div>
                </div>
            </div>

            {/* Active filters badges row */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 bg-muted/30 p-3 rounded-xl border items-center">
                    <span className="text-sm font-semibold text-muted-foreground mr-2">Active Filters ({filteredStudents.length} results):</span>
                    {statusFilter.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s}</span>)}
                    {activityFilter !== "all" && <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">Activity: {activityFilter}</span>}
                    {financeFilter !== "all" && <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">Finances: {financeFilter}</span>}
                    {documentFilter.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s.replace(/_/g, ' ')}</span>)}
                    {startDateRange.from && <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">Started &gt;= {startDateRange.from}</span>}
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs ml-auto">Clear Filters</Button>
                </div>
            )}

            <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {initialStudents.length === 0 ? (
                        <div className="text-center py-16">
                            <GraduationCap className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No students registered yet</h3>
                            <p className="text-muted-foreground mb-6">Start by adding your first student to the system.</p>
                            <div className="flex justify-center">
                                <AddStudentDialog isSuperAdmin={isSuperAdmin} />
                            </div>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-16">
                            <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No students match your criteria</h3>
                            <p className="text-muted-foreground mb-6">Try adjusting your filters or search term.</p>
                            <Button onClick={clearFilters} variant="outline" className="rounded-xl">Clear All Filters</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-muted-foreground/80">
                                        <th className="text-left p-4 font-semibold">Student</th>
                                        <th className="text-left p-4 font-semibold hidden md:table-cell">Supervisor</th>
                                        <th className="text-left p-4 font-semibold hidden lg:table-cell">BACB ID</th>
                                        <th className="text-left p-4 font-semibold hidden sm:table-cell">Status</th>
                                        <th className="text-right p-4 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student) => (
                                        <tr key={student.id} className="border-b hover:bg-muted/30 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-primary/20 bg-background shadow-xs">
                                                        <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                                                            {student.fullName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || 'ST'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold text-foreground">{student.fullName}</p>
                                                        <p className="text-xs text-muted-foreground/80">{student.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <div className="flex flex-col gap-1">
                                            {student.supervisors && student.supervisors.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {student.supervisors.map((s: any) => (
                                                        <div key={s.supervisorId} className="flex items-center gap-1">
                                                            <span className={`font-medium ${s.isPrimary ? 'text-foreground' : 'text-muted-foreground text-xs italic'}`}>
                                                                {s.supervisor.fullName}
                                                                {s.isPrimary && <Badge variant="outline" className="ml-2 text-[8px] h-3 px-1 border-emerald-500/30 text-emerald-600 bg-emerald-50">Prim</Badge>}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground/70 font-medium">Not Assigned</span>
                                            )}
                                                </div>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell text-muted-foreground font-medium">
                                                {student.bacbId || '-'}
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <span className={`text-[11px] font-bold px-2 py-1 rounded-full border ${!student.user?.isActive
                                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                                    : student.status === 'ACTIVE'
                                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                    }`}>
                                                    {!student.user?.isActive ? 'INACTIVE' : (student.status || 'PENDING')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                                                        <Link href={`/office/students/${student.id}`}>
                                                            <Eye className="h-4 w-4 mr-2" /> View
                                                        </Link>
                                                    </Button>
                                                    <UserActions
                                                        id={student.id}
                                                        userId={student.userId}
                                                        name={student.fullName}
                                                        email={student.email}
                                                        type="student"
                                                        isActive={student.user?.isActive ?? true}
                                                        isSuperAdmin={isSuperAdmin}
                                                        isQaSuper={isQaSuper}
                                                        fullData={student}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
