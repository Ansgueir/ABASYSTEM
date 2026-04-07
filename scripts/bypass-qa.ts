
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const emails = [
        'qaestudiante@abasystem.com',
        'qasupervisor@abasystem.com',
        'qaoffice@abasystem.com',
        'qa-super@abasystem.com'
    ]

    for (const email of emails) {
        await prisma.user.update({
            where: { email },
            data: {
                isFirstLogin: false,
                onboardingCompleted: true,
                onboardingStep: 3
            }
        })
        console.log(`Bypassed onboarding for ${email}`)
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
