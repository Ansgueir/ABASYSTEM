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
