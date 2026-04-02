"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"

interface LogFiltersProps {
    students: string[]
    supervisors: string[]
    selectedStudent: string
    selectedSupervisor: string
    activeTab: string
}

export function LogFilters({ 
    students, 
    supervisors, 
    selectedStudent, 
    selectedSupervisor,
    activeTab 
}: LogFiltersProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    
    const selectedMonth = searchParams.get("month") || ""
    const selectedYear = searchParams.get("year") || new Date().getFullYear().toString()

    const updateFilter = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(name, value)
        } else {
            params.delete(name)
        }
        router.push(`/office/supervision-logs?${params.toString()}`)
    }

    const clearFilters = () => {
        router.push(`/office/supervision-logs?tab=${activeTab.toLowerCase()}`)
    }

    const months = [
        { value: "0", label: "January" }, { value: "1", label: "February" }, { value: "2", label: "March" },
        { value: "3", label: "April" }, { value: "4", label: "May" }, { value: "5", label: "June" },
        { value: "6", label: "July" }, { value: "7", label: "August" }, { value: "8", label: "September" },
        { value: "9", label: "October" }, { value: "10", label: "November" }, { value: "11", label: "December" }
    ]

    const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString())

    return (
        <div className="bg-muted/30 p-4 rounded-2xl border border-border flex flex-wrap items-end gap-4 mb-6 transition-all duration-300">
            <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Student</Label>
                <select 
                    value={selectedStudent}
                    onChange={(e) => updateFilter("student", e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                    <option value="">- All Students -</option>
                    {students.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Supervisor</Label>
                <select 
                    value={selectedSupervisor}
                    onChange={(e) => updateFilter("supervisor", e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                    <option value="">- All Supervisors -</option>
                    {supervisors.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5 w-[140px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Month</Label>
                <select 
                    value={selectedMonth}
                    onChange={(e) => updateFilter("month", e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                    <option value="">- Full Year -</option>
                    {months.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5 w-[100px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Year</Label>
                <select 
                    value={selectedYear}
                    onChange={(e) => updateFilter("year", e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-input rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                >
                    {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>

            {(selectedStudent || selectedSupervisor || selectedMonth) && (
                <Button 
                    variant="ghost" 
                    className="h-10 text-xs text-muted-foreground hover:text-destructive transition-colors"
                    onClick={clearFilters}
                >
                    Clear Filters
                </Button>
            )}
        </div>
    )
}
