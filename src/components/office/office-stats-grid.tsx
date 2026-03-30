"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Users, GraduationCap, DollarSign, TrendingUp } from "lucide-react"
import useSWR from "swr"

interface StatData {
    totalStudents: number
    totalSupervisors: number
    pendingPayments: number
    totalPaidOut?: number
}

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function OfficeStatsGrid({ initialStats, isSuperAdmin }: { initialStats: StatData; isSuperAdmin: boolean }) {
    const { data } = useSWR<StatData>('/api/office/stats', fetcher, {
        fallbackData: initialStats,
        refreshInterval: 10000 
    })

    const stats = data || initialStats

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="animate-slide-up" style={{ animationDelay: '0ms' }}>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <GraduationCap className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Students</p>
                            <p className="text-2xl font-bold">{stats.totalStudents}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                            <Users className="h-6 w-6 text-success" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Supervisors</p>
                            <p className="text-2xl font-bold">{stats.totalSupervisors}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-warning" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pending Payments</p>
                            <p className="text-2xl font-bold">{stats.pendingPayments}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
