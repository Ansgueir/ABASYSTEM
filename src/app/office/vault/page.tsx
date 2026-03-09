import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert, RotateCcw, Eye } from "lucide-react"
import { RecoverActionBtn } from "./recover-btn"

export default async function VaultPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    if (session.user.email?.toLowerCase().trim() !== "qa-super@abasystem.com") {
        notFound()
    }

    const hiddenUsers = await prisma.user.findMany({
        where: { isHidden: true },
        include: {
            student: true,
            supervisor: true,
            officeMember: true
        }
    })

    return (
        <DashboardLayout role="office">
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                        <ShieldAlert className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-destructive to-red-400 bg-clip-text text-transparent">QA Data Vault</h1>
                        <p className="text-muted-foreground font-medium flex items-center gap-2">
                            Secure isolation chamber for ghosted accounts. Only qa-super@abasystem.com has access.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6">
                    {hiddenUsers.length === 0 ? (
                        <Card className="border-dashed shadow-none">
                            <CardContent className="flex flex-col items-center justify-center p-12">
                                <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground">The vault is currently empty.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        hiddenUsers.map((user) => {
                            let type: "student" | "supervisor" | "office" = "office"
                            let name = "Unknown"
                            let id = ""

                            if (user.student) {
                                type = "student"
                                name = user.student.fullName
                                id = user.student.id
                            } else if (user.supervisor) {
                                type = "supervisor"
                                name = user.supervisor.fullName
                                id = user.supervisor.id
                            } else if (user.officeMember) {
                                type = "office"
                                name = user.officeMember.fullName
                                id = user.officeMember.id
                            }

                            return (
                                <Card key={user.id} className="border-destructive/20 relative overflow-hidden group hover:border-destructive/40 transition-colors shadow-sm">
                                    <div className="absolute top-0 right-0 p-2 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider rounded-bl-xl border-b border-l border-destructive/20 pointer-events-none">
                                        Hidden {type}
                                    </div>
                                    <CardContent className="p-6">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <h3 className="text-lg font-bold text-gray-900 group-hover:text-destructive transition-colors">{name}</h3>
                                                <div className="flex items-center text-sm text-gray-500 gap-2 mt-1">
                                                    <span>{user.email}</span>
                                                    <span className="text-muted-foreground/30">•</span>
                                                    <span>Archived Account</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {type !== "office" && (
                                                    <a href={`/office/${type}s/${id}`}>
                                                        <Button variant="outline" size="sm" className="hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors">
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            View Profile
                                                        </Button>
                                                    </a>
                                                )}
                                                <RecoverActionBtn id={id} type={type} name={name} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
