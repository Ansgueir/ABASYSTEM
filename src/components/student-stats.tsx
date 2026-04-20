import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle } from "lucide-react"
import { getMonthStats } from "@/lib/stats"

export async function StudentStats({ studentId }: { studentId: string }) {
    const stats = await getMonthStats(studentId)

    return (
        <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Master Plan Total</CardTitle>
                    <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{(stats.lifetimeIndependent + stats.lifetimeSupervision).toFixed(1)} / {stats.totalLifetime}</div>
                    <Progress value={((stats.lifetimeIndependent + stats.lifetimeSupervision) / stats.totalLifetime) * 100} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        Monthly: {stats.total.toFixed(1)}h / {stats.limit}h limit
                    </p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Independent (Lifetime)</CardTitle>
                    <Clock className="h-4 w-4 text-indigo-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lifetimeIndependent.toFixed(1)} / {stats.maxIndependentTotal.toFixed(1)}</div>
                    <Progress value={(stats.lifetimeIndependent / (stats.maxIndependentTotal || 1)) * 100} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        Monthly: {stats.totalIndependent.toFixed(1)}h (Target: {stats.maxIndependentMonth.toFixed(1)}h)
                    </p>
                </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Supervision (Lifetime)</CardTitle>
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stats.lifetimeSupervision.toFixed(1)} / {stats.maxSupervisionTotal.toFixed(1)}</div>
                    <Progress value={(stats.lifetimeSupervision / (stats.maxSupervisionTotal || 1)) * 100} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        Monthly: {stats.totalSupervision.toFixed(1)}h (Target {stats.supervisionTargetPct.toFixed(0)}%: {stats.maxSupervisionMonth.toFixed(1)}h)
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
