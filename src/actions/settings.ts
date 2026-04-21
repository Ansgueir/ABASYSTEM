"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { serialize } from "@/lib/serialize"
import { logAudit } from "@/lib/audit"

export async function getGeneralSettings() {
    try {
        let settings = await prisma.generalValues.findFirst()

        if (!settings) {
            settings = await prisma.generalValues.create({
                data: {
                    rateRegular: 45.0,
                    rateConcentrated: 60.0,
                    supervisorPaymentPercentage: 0.54,
                    companyName: "ABA Supervisors System",
                    companyAddress: "123 Main St, Miami, FL",
                    companyPhone: "(555) 123-4567",
                    companyEmail: "office@abasystem.com",
                    companyWebsite: "www.abasystem.com",
                    companyTaxId: "XX-XXXXXXX",
                    companyLogoUrl: "",
                    maxHoursPerMonth: 130,
                    restrictedAlertPercent: 40,
                    emailNotificationsEnabled: true
                } as any // Use as any to prevent build failing on local without DB push generated
            })
        }
        return { success: true, settings: serialize(settings) }
    } catch (error) {
        console.error("Error fetching general settings:", error)
        return { success: false, error: "Failed to fetch general settings" }
    }
}

export async function updateGeneralSettings(formData: FormData) {
    try {
        const session = await auth()
        if (!session?.user) return { success: false, error: "Unauthorized" }

        const role = String((session.user as any).role).toUpperCase()
        const officeRole = String((session.user as any).officeRole).toUpperCase()

        if (role !== "QA" && officeRole !== "SUPER_ADMIN") {
            return { success: false, error: "Forbidden - Super Admin access required" }
        }

        const settings = await prisma.generalValues.findFirst()
        if (!settings) {
            return { success: false, error: "Settings record not found" }
        }

        const companyName = formData.get("companyName") as string
        const companyEmail = formData.get("companyEmail") as string
        const companyPhone = formData.get("companyPhone") as string
        const companyAddress = formData.get("companyAddress") as string

        const maxHoursPerMonth = parseInt(formData.get("maxHours") as string) || (settings as any).maxHoursPerMonth || 130
        const restrictedAlertPercent = parseInt(formData.get("restrictedAlert") as string) || (settings as any).restrictedAlertPercent || 40
        const emailNotificationsEnabled = formData.get("emailNotificationsEnabled") === "true"

        const rawBcbaRate = parseFloat(formData.get("bcbaRate") as string)
        const supervisorPaymentPercentage = rawBcbaRate ? rawBcbaRate / 100 : settings.supervisorPaymentPercentage

        await prisma.generalValues.update({
            where: { id: settings.id },
            data: {
                companyName: companyName || settings.companyName,
                companyEmail: companyEmail || settings.companyEmail,
                companyPhone: companyPhone || settings.companyPhone,
                companyAddress: companyAddress || settings.companyAddress,
                supervisorPaymentPercentage,
                maxHoursPerMonth,
                restrictedAlertPercent,
                emailNotificationsEnabled
            } as any
        })

        await logAudit({
            action: "UPDATE",
            entity: "System",
            entityId: settings.id,
            details: `Updated general settings`,
            oldValues: settings,
            newValues: {
                companyName: companyName || settings.companyName,
                companyEmail: companyEmail || settings.companyEmail,
                companyPhone: companyPhone || settings.companyPhone,
                companyAddress: companyAddress || settings.companyAddress,
                supervisorPaymentPercentage,
                maxHoursPerMonth,
                restrictedAlertPercent,
                emailNotificationsEnabled
            }
        })

        revalidatePath("/", "layout")
        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Internal Server Error" }
    }
}
