import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert, RotateCcw, Eye } from "lucide-react"
import { RecoverActionBtn } from "./recover-btn"

import { VaultClientTabs } from "./vault-client-tabs"
import { serialize } from "@/lib/serialize"

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

                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    {/* Placeholder for Tabs until we create the Client Component */}
                    <VaultClientTabs hiddenUsers={serialize(hiddenUsers)} />
                </div>
            </div>
        </DashboardLayout>
    )
}
