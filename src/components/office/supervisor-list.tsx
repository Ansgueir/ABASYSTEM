"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, Download, Eye, Filter, X, CalendarIcon } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddSupervisorDialog } from "@/components/office/add-supervisor-dialog"
import { UserActions } from "@/components/office/user-actions"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import * as XLSX from "xlsx"

interface SupervisorListProps {
    initialSupervisors: any[]
    isSuperAdmin: boolean
}

export function SupervisorList({ initialSupervisors, isSuperAdmin }: SupervisorListProps) {
    const [searchTerm, setSearchTerm] = useState("")

    // Advanced Filters State
    const [statusFilter, setStatusFilter] = useState<string[]>([])
    const [credentialFilter, setCredentialFilter] = useState<string[]>([])
    const [studentCountRange, setStudentCountRange] = useState<{ min?: string, max?: string }>({})
    const [commissionFilter, setCommissionFilter] = useState<string[]>([])
    const [enrollmentDateRange, setEnrollmentDateRange] = useState<{ from?: string, to?: string }>({})

    const uniqueCredentials = useMemo(() => {
        const set = new Set(initialSupervisors.map(s => s.credentialType || 'BCBA'))
        return Array.from(set) as string[]
    }, [initialSupervisors])

    const uniqueCommissions = useMemo(() => {
        const set = new Set(initialSupervisors.map(s => Number(s.paymentPercentage || 0.54)))
        return Array.from(set).sort() as number[]
    }, [initialSupervisors])

    // Filter supervisors
    const filteredSupervisors = useMemo(() => {
        return initialSupervisors.filter(supervisor => {
            const matchesSearch =
                supervisor.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                supervisor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                supervisor.bacbId?.toLowerCase().includes(searchTerm.toLowerCase())

            // Status Map
            const derivedStatus = !supervisor.user?.isActive ? 'INACTIVE' : (supervisor.status || 'ACTIVE')
            const matchesStatus = statusFilter.length === 0 || statusFilter.includes(derivedStatus.toUpperCase())

            // Credential
            const credential = supervisor.credentialType || 'BCBA'
            const matchesCredential = credentialFilter.length === 0 || credentialFilter.includes(credential)

            // Student Count
            let matchesStudentCount = true
            const studentsCount = supervisor._count?.students || 0
            if (studentCountRange.min && studentsCount < Number(studentCountRange.min)) matchesStudentCount = false
            if (studentCountRange.max && studentsCount > Number(studentCountRange.max)) matchesStudentCount = false

            // Commission
            const commission = Number(supervisor.paymentPercentage || 0.54)
            const matchesCommission = commissionFilter.length === 0 || commissionFilter.includes(commission.toString())

            // Enrollment Date (created at)
            let matchesEnrollmentDate = false
            if (!enrollmentDateRange.from && !enrollmentDateRange.to) matchesEnrollmentDate = true
            else if (supervisor.createdAt) {
                const cDate = new Date(supervisor.createdAt)
                const isAfterFrom = !enrollmentDateRange.from || cDate >= new Date(enrollmentDateRange.from)
                const isBeforeTo = !enrollmentDateRange.to || cDate <= new Date(enrollmentDateRange.to)
                matchesEnrollmentDate = isAfterFrom && isBeforeTo
            }

            return matchesSearch && matchesStatus && matchesCredential && matchesStudentCount &&
                matchesCommission && matchesEnrollmentDate
        })
    }, [initialSupervisors, searchTerm, statusFilter, credentialFilter, studentCountRange, commissionFilter, enrollmentDateRange])

    const activeFiltersCount =
        statusFilter.length + credentialFilter.length + commissionFilter.length +
        (studentCountRange.min || studentCountRange.max ? 1 : 0) +
        (enrollmentDateRange.from || enrollmentDateRange.to ? 1 : 0)

    const clearFilters = () => {
        setStatusFilter([])
        setCredentialFilter([])
        setStudentCountRange({})
        setCommissionFilter([])
        setEnrollmentDateRange({})
    }

    const handleExport = (format: "xlsx" | "csv") => {
        const exportData = filteredSupervisors.map(s => ({
            Name: s.fullName,
            Email: s.email || 'No email',
            Credential: s.credentialType || 'BCBA',
            BACB: s.bacbId || '-',
            "Commission (%)": `${Number(s.paymentPercentage || 0.54) * 100}%`,
            "Students Count": s._count?.students || 0,
            "Enrollment Date": s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-',
            Status: !s.user?.isActive ? 'INACTIVE' : (s.status || 'ACTIVE')
        }))

        const ws = XLSX.utils.json_to_sheet(exportData)
        ws['!cols'] = [
            { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Supervisors")
        XLSX.writeFile(wb, `Supervisor_Export.${format}`)
    }

    const toggleArrayFilter = (state: string[], setState: any, val: string) => {
        setState(state.includes(val) ? state.filter(x => x !== val) : [...state, val])
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Supervisors</h1>
                    <p className="text-muted-foreground">Manage all registered supervisors</p>
                </div>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email or BACB ID..."
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
                                        Narrow down the supervisor list by applying one or more filters below.
                                    </SheetDescription>
                                </SheetHeader>

                                <div className="space-y-8 pb-12">
                                    {/* Status */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Status</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {['ACTIVE', 'INACTIVE'].map(status => (
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

                                    {/* Credential */}
                                    <div className="space-y-3">
                                        <h4 className="font-semibold text-sm">Professional Credential</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {uniqueCredentials.map(cred => (
                                                <Button
                                                    key={cred}
                                                    variant={credentialFilter.includes(cred) ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => toggleArrayFilter(credentialFilter, setCredentialFilter, cred)}
                                                    className="rounded-full"
                                                >
                                                    {cred}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Student Workload */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-semibold text-sm">Workload (Assigned Students)</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Min Students</Label>
                                                <Input type="number" min="0" placeholder="e.g. 0" value={studentCountRange.min || ''} onChange={e => setStudentCountRange({ ...studentCountRange, min: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Max Students</Label>
                                                <Input type="number" min="0" placeholder="e.g. 10" value={studentCountRange.max || ''} onChange={e => setStudentCountRange({ ...studentCountRange, max: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Finances */}
                                    <div className="space-y-3 pt-4 border-t">
                                        <h4 className="font-semibold text-sm">Finances (Commission)</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {uniqueCommissions.map(comm => (
                                                <Button
                                                    key={comm}
                                                    variant={commissionFilter.includes(comm.toString()) ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => toggleArrayFilter(commissionFilter, setCommissionFilter, comm.toString())}
                                                    className="rounded-full"
                                                >
                                                    {comm * 100}%
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dates Ranges */}
                                    <div className="space-y-4 pt-4 border-t">
                                        <h4 className="font-semibold text-sm text-primary">Enrollment Date</h4>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">From</Label>
                                                <Input type="date" value={enrollmentDateRange.from || ''} onChange={e => setEnrollmentDateRange({ ...enrollmentDateRange, from: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">To</Label>
                                                <Input type="date" value={enrollmentDateRange.to || ''} onChange={e => setEnrollmentDateRange({ ...enrollmentDateRange, to: e.target.value })} />
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

                        <AddSupervisorDialog />
                    </div>
                </div>
            </div>

            {/* Active filters badges row */}
            {activeFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 bg-muted/30 p-3 rounded-xl border items-center">
                    <span className="text-sm font-semibold text-muted-foreground mr-2">Active Filters ({filteredSupervisors.length} results):</span>
                    {statusFilter.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s}</span>)}
                    {credentialFilter.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{s}</span>)}
                    {commissionFilter.map(s => <span key={s} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{Number(s) * 100}%</span>)}
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs ml-auto">Clear Filters</Button>
                </div>
            )}

            <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                    {initialSupervisors.length === 0 ? (
                        <div className="text-center py-16">
                            <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No supervisors registered yet</h3>
                            <p className="text-muted-foreground mb-6">Start by adding your first supervisor to the system.</p>
                            <div className="flex justify-center">
                                <AddSupervisorDialog />
                            </div>
                        </div>
                    ) : filteredSupervisors.length === 0 ? (
                        <div className="text-center py-16">
                            <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No supervisors match your criteria</h3>
                            <p className="text-muted-foreground mb-6">Try adjusting your filters or search term.</p>
                            <Button onClick={clearFilters} variant="outline" className="rounded-xl">Clear All Filters</Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-muted-foreground/80">
                                        <th className="text-left p-4 font-semibold">Supervisor</th>
                                        <th className="text-left p-4 font-semibold hidden md:table-cell">Credential</th>
                                        <th className="text-left p-4 font-semibold hidden lg:table-cell">Students</th>
                                        <th className="text-left p-4 font-semibold hidden sm:table-cell">Commission</th>
                                        <th className="text-right p-4 font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSupervisors.map((supervisor: any) => (
                                        <tr key={supervisor.id} className="border-b hover:bg-muted/30 transition-colors group">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border-2 border-emerald-500/20 bg-background shadow-xs">
                                                        <AvatarFallback className="bg-emerald-500/5 text-emerald-600 font-semibold text-sm">
                                                            {supervisor.fullName?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || 'SV'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold text-foreground">{supervisor.fullName}</p>
                                                        <p className="text-xs text-muted-foreground/80">{supervisor.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <span className="text-xs font-bold px-2 py-1 rounded border bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                    {supervisor.credentialType || 'BCBA'}
                                                </span>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell">
                                                <span className="font-medium">{supervisor._count?.students || 0}</span>
                                                <span className="text-muted-foreground/70"> / {supervisor.maxStudents || 10}</span>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <span className="font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-sm border border-emerald-500/20">
                                                    {Number(supervisor.paymentPercentage || 0.54) * 100}%
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="sm" asChild className="h-8 rounded-lg hover:bg-primary/10 hover:text-primary">
                                                        <Link href={`/office/supervisors/${supervisor.id}`}>
                                                            <Eye className="h-4 w-4 mr-2" /> View
                                                        </Link>
                                                    </Button>
                                                    <UserActions
                                                        id={supervisor.id}
                                                        userId={supervisor.userId}
                                                        name={supervisor.fullName}
                                                        email={supervisor.user?.email || supervisor.email}
                                                        type="supervisor"
                                                        isActive={supervisor.user?.isActive ?? true}
                                                        fullData={supervisor}
                                                        isSuperAdmin={isSuperAdmin}
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
