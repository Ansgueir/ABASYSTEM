import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
import bcrypt from "bcryptjs"

const QA_SUPER_EMAIL = "qa-super@abasystem.com"
const QA_SUPER_PASSWORD = "Password123!"

async function main() {
    console.log("Setting up QA Super Admin user...")

    try {
        // cleanup existing
        const existing = await prisma.user.findUnique({ where: { email: QA_SUPER_EMAIL } })
        if (existing) {
            console.log("Deleting existing QA Super user...")
            // delete relations first if needed, but cascade might handle it or we do it manually
            // OfficeMember
            await prisma.officeMember.deleteMany({ where: { userId: existing.id } })
            await prisma.user.delete({ where: { id: existing.id } })
        }

        const hashedPassword = await bcrypt.hash(QA_SUPER_PASSWORD, 10)

        const user = await prisma.user.create({
            data: {
                email: QA_SUPER_EMAIL,
                passwordHash: hashedPassword,
                role: "OFFICE",
                isActive: true,
                isFirstLogin: false,
                onboardingCompleted: true,
            }
        })

        // Create OfficeMember profile
        await prisma.officeMember.create({
            data: {
                userId: user.id,
                fullName: "QA Super Admin",
                officeRole: "SUPER_ADMIN"
            }
        })

        console.log(`✅ QA Super Admin created!`)
        console.log(`Email: ${QA_SUPER_EMAIL}`)
        console.log(`Password: ${QA_SUPER_PASSWORD}`)

    } catch (e) {
        console.error("Error creating QA Super Admin:", e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
