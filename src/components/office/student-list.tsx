"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GraduationCap, Search, Download, Eye, Filter, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AddStudentDialog } from "@/components/office/add-student-dialog"
import { UserActions } from "@/components/office/user-actions"
import Link from "next/link"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import * as XLSX from "xlsx"

interface StudentListProps {
    initialStudents: any[]
    isSuperAdmin: boolean
}

export function StudentList({ initialStudents, isSuperAdmin }: StudentListProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [supervisorFilter, setSupervisorFilter] = useState("all")

    const uniqueSupervisors = useMemo(() => {
        const map = new Map()
        initialStudents.forEach(s => {
            if (s.supervisor) {
                map.set(s.supervisor.id, s.supervisor.fullName)
            }
        })
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
    }, [initialStudents])

    // Filter students
    const filteredStudents = useMemo(() => {
        return initialStudents.filter(student => {
            const matchesSearch =
                student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                student.supervisor?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())

            const derivedStatus = !student.user?.isActive ? 'INACTIVE' : (student.status || 'PENDING')
            const matchesStatus = statusFilter === "all" || derivedStatus.toLowerCase() === statusFilter.toLowerCase()

            const supervisorId = student.supervisor?.id || "unassigned"
            const matchesSupervisor = supervisorFilter === "all" ||
                (supervisorFilter === "unassigned" && !student.supervisor) ||
                supervisorId === supervisorFilter

            return matchesSearch && matchesStatus && matchesSupervisor
        })
    }, [initialStudents, searchTerm, statusFilter, supervisorFilter])

    // Export logic
    const handleExport = (format: "xlsx" | "csv") => {
        const exportData = filteredStudents.map(s => ({
            Name: s.fullName,
            Email: s.email || 'No email',
            "Assigned Supervisor": s.supervisor?.fullName || 'Not assigned',
            Degree: s.academicDegree || '-',
            Status: !s.user?.isActive ? 'INACTIVE' : (s.status || 'PENDING'),
            "Start Date": s.startDate ? new Date(s.startDate).toLocaleDateString() : '-',
            "End Date": s.endDate ? new Date(s.endDate).toLocaleDateString() : '-',
            Organization: s.school || '-'
        }))

        const ws = XLSX.utils.json_to_sheet(exportData)

        // Simple cell styling/widths could be added here if using a pro version or exceljs
        // For basic xlsx, we just set column widths
        ws['!cols'] = [
            { wch: 25 }, // Name
            { wch: 30 }, // Email
            { wch: 25 }, // Supervisor
            { wch: 15 }, // Degree
            { wch: 15 }, // Status
            { wch: 15 }, // Start
            { wch: 15 }, // End
            { wch: 20 }, // Organization
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Students")

        if (format === "xlsx") {
            XLSX.writeFile(wb, "Student_Export.xlsx")
        } else {
            XLSX.writeFile(wb, "Student_Export.csv")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Students</h1>
                    <p className="text-muted-foreground">Manage all registered students</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search students..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="rounded-xl gap-2 relative">
                                <Filter className="h-4 w-4" />
                                <span className="hidden sm:inline">Filter</span>
                                {(statusFilter !== "all" || supervisorFilter !== "all") && (
                                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between font-medium">
                                    <h4>Filters</h4>
                                    {(statusFilter !== "all" || supervisorFilter !== "all") && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto p-0 text-muted-foreground hover:text-foreground"
                                            onClick={() => {
                                                setStatusFilter("all")
                                                setSupervisorFilter("all")
                                            }}
                                        >
                                            Reset
                                        </Button>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="active">Active</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Assigned Supervisor</Label>
                                    <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Supervisors" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Supervisors</SelectItem>
                                            <SelectItem value="unassigned">Not Assigned</SelectItem>
                                            {uniqueSupervisors.map(sv => (
                                                <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-xl gap-2">
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Export</span>
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

            <Card>
                <CardContent className="p-0">
                    {initialStudents.length === 0 ? (
                        <div className="text-center py-12">
                            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No students registered yet</p>
                            <div className="mt-4 flex justify-center">
                                <AddStudentDialog isSuperAdmin={isSuperAdmin} />
                            </div>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="text-center py-12">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No students found matching your search.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left p-4 font-medium">Student</th>
                                        <th className="text-left p-4 font-medium hidden md:table-cell">Supervisor</th>
                                        <th className="text-left p-4 font-medium hidden lg:table-cell">Degree</th>
                                        <th className="text-left p-4 font-medium hidden sm:table-cell">Status</th>
                                        <th className="text-right p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStudents.map((student) => (
                                        <tr key={student.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                                                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                            {student.fullName?.split(' ').map((n: string) => n[0]).join('') || 'ST'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{student.fullName}</p>
                                                        <p className="text-sm text-muted-foreground">{student.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <span className="text-sm">{student.supervisor?.fullName || 'Not assigned'}</span>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell">
                                                <span className="text-sm">{student.academicDegree || '-'}</span>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <span className={`text-xs px-2 py-1 rounded-full ${!student.user?.isActive
                                                    ? 'bg-red-100 text-red-700'
                                                    : student.status === 'ACTIVE'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                    {!student.user?.isActive ? 'INACTIVE' : (student.status || 'PENDING')}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" asChild className="gap-1">
                                                        <Link href={`/office/students/${student.id}`}>
                                                            <Eye className="h-4 w-4" /> View
                                                        </Link>
                                                    </Button>
                                                    <UserActions
                                                        id={student.id}
                                                        userId={student.userId}
                                                        name={student.fullName}
                                                        email={student.email}
                                                        type="student"
                                                        isActive={student.user?.isActive ?? true}
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
