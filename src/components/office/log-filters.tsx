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

    const updateFilter = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value) {
            params.set(name, value)
        } else {
            params.delete(name)
        }
        // Always reset pagination or search if needed, here we just push
        router.push(`/office/supervision-logs?${params.toString()}`)
    }

    const clearFilters = () => {
        router.push(`/office/supervision-logs?tab=${activeTab.toLowerCase()}`)
    }

    return (
        <div className="bg-muted/30 p-4 rounded-2xl border border-border flex flex-wrap items-end gap-4 mb-6">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filter Student</Label>
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

            <div className="space-y-1.5 flex-1 min-w-[200px]">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Filter Supervisor</Label>
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

            {(selectedStudent || selectedSupervisor) && (
                <Button 
                    variant="ghost" 
                    className="h-10 text-xs text-muted-foreground hover:text-destructive"
                    onClick={clearFilters}
                >
                    Clear Filters
                </Button>
            )}
        </div>
    )
}
