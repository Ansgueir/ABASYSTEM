import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { getMonthStats } from "@/lib/stats"

export async function StudentStats({ studentId }: { studentId: string }) {
    const stats = await getMonthStats(studentId)

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.total.toFixed(1)} / {stats.limit}</div>
                    <Progress value={(stats.total / stats.limit) * 100} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        {((stats.total / stats.limit) * 100).toFixed(1)}% of monthly limit
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Supervision</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.supervisionPercentage.toFixed(1)}%</div>
                    <Progress value={stats.supervisionPercentage * 20} className="h-2 mt-2" />
                    {/* Scale: 5% is minimum goal. If we map 0-5% to 0-100%, 5% = 100% logic? No, let's just show raw % but maybe color. */}
                    <p className="text-xs text-muted-foreground mt-2">
                        Target: 5% minimum
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Restricted</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.restrictedPercentage.toFixed(1)}%</div>
                    <Progress value={stats.restrictedPercentage} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        Max 40% (BCBA) / 60% (BCaBA)
                    </p>
                </CardContent>
            </Card>
            {/* Can add more stats */}
        </div>
    )
}
