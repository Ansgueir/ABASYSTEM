import DashboardLayout from "@/components/dashboard-layout"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { getGeneralSettings } from "@/actions/settings"
import { SettingsClient } from "./settings-client"

export default async function OfficeSettingsPage() {
    const session = await auth()
    if (!session?.user) redirect("/login")

    const role = String((session.user as any).role).toLowerCase()
    const officeRole = String((session.user as any).officeRole).toUpperCase()

    // Check permission - RBAC
    if (role !== "qa" && officeRole !== "SUPER_ADMIN") {
        return (
            <DashboardLayout role="office">
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                    <h1 className="text-4xl font-bold text-destructive">403</h1>
                    <h2 className="text-2xl font-semibold">Forbidden</h2>
                    <p className="text-muted-foreground">You do not have permission to view global system settings. Only Super Admins have access.</p>
                </div>
            </DashboardLayout>
        )
    }

    const { settings } = await getGeneralSettings()

    return (
        <DashboardLayout role="office">
            <SettingsClient settings={settings} />
        </DashboardLayout>
    )
}
