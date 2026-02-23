"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { serialize } from "@/lib/serialize"

export async function getGeneralSettings() {
    try {
        let settings = await prisma.generalValues.findFirst()

        if (!settings) {
            settings = await prisma.generalValues.create({
                data: {
                    rateRegular: 45.0,
                    rateConcentrated: 60.0,
                    supervisorPaymentPercentage: 0.54,
                    companyName: "ABA Supervision Clinic",
                    companyAddress: "123 Main St, Miami, FL",
                    companyPhone: "(555) 123-4567",
                    companyEmail: "office@abaclinic.com",
                    companyWebsite: "www.abaclinic.com",
                    companyTaxId: "XX-XXXXXXX",
                    companyLogoUrl: "" // Will be populated with a logo link later
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

        const rawBcbaRate = parseFloat(formData.get("bcbaRate") as string)
        const supervisorPaymentPercentage = rawBcbaRate ? rawBcbaRate / 100 : settings.supervisorPaymentPercentage

        await prisma.generalValues.update({
            where: { id: settings.id },
            data: {
                companyName: companyName || settings.companyName,
                companyEmail: companyEmail || settings.companyEmail,
                companyPhone: companyPhone || settings.companyPhone,
                companyAddress: companyAddress || settings.companyAddress,
                supervisorPaymentPercentage
            } as any
        })

        revalidatePath("/", "layout")
        return { success: true }
    } catch (error) {
        console.error("Error updating settings:", error)
        return { success: false, error: "Internal Server Error" }
    }
}
