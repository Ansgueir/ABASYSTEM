"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Search, Download, Eye } from "lucide-react"
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
import * as XLSX from "xlsx"

interface SupervisorListProps {
    initialSupervisors: any[]
    isSuperAdmin: boolean
}

export function SupervisorList({ initialSupervisors, isSuperAdmin }: SupervisorListProps) {
    const [searchTerm, setSearchTerm] = useState("")

    // Filter supervisors
    const filteredSupervisors = useMemo(() => {
        return initialSupervisors.filter(supervisor => {
            const matchesSearch =
                supervisor.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                supervisor.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                supervisor.bacbId?.toLowerCase().includes(searchTerm.toLowerCase())
            return matchesSearch
        })
    }, [initialSupervisors, searchTerm])

    // Export logic
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
            { wch: 25 }, // Name
            { wch: 30 }, // Email
            { wch: 15 }, // Credential
            { wch: 15 }, // BACB
            { wch: 15 }, // Commission
            { wch: 15 }, // Students Count
            { wch: 20 }, // Enrollment Date
            { wch: 15 }, // Status
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Supervisors")

        if (format === "xlsx") {
            XLSX.writeFile(wb, "Supervisor_Export.xlsx")
        } else {
            XLSX.writeFile(wb, "Supervisor_Export.csv")
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Supervisors</h1>
                    <p className="text-muted-foreground">Manage all registered supervisors</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search supervisors..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

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

                    <AddSupervisorDialog />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {initialSupervisors.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No supervisors registered yet</p>
                            <div className="mt-4 flex justify-center">
                                <AddSupervisorDialog />
                            </div>
                        </div>
                    ) : filteredSupervisors.length === 0 ? (
                        <div className="text-center py-12">
                            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No supervisors found matching your search.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left p-4 font-medium">Supervisor</th>
                                        <th className="text-left p-4 font-medium hidden md:table-cell">Credential</th>
                                        <th className="text-left p-4 font-medium hidden lg:table-cell">Students</th>
                                        <th className="text-left p-4 font-medium hidden sm:table-cell">Commission</th>
                                        <th className="text-right p-4 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSupervisors.map((supervisor: any) => (
                                        <tr key={supervisor.id} className="border-b hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9 border-2 border-success/20">
                                                        <AvatarFallback className="bg-success/10 text-success text-sm">
                                                            {supervisor.fullName?.split(' ').map((n: string) => n[0]).join('') || 'SV'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-medium">{supervisor.fullName}</p>
                                                        <p className="text-sm text-muted-foreground">{supervisor.email || 'No email'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                                                    {supervisor.credentialType || 'BCBA'}
                                                </span>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell">
                                                <span className="text-sm">{supervisor._count?.students || 0} / {supervisor.maxStudents || 10}</span>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <span className="text-sm font-medium">{Number(supervisor.paymentPercentage || 0.54) * 100}%</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" asChild className="gap-1">
                                                        <Link href={`/office/supervisors/${supervisor.id}`}>
                                                            <Eye className="h-4 w-4" /> View
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
