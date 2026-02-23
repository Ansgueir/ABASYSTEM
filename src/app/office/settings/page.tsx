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
        redirect("/office")
    }

    const { settings } = await getGeneralSettings()

    return (
        <DashboardLayout role="office">
            <SettingsClient settings={settings} />
        </DashboardLayout>
    )
}
