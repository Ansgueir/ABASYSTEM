import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'qaestudiante@abasystem.com'
    const password = 'Password123!'

    console.log(`Checking user: ${email}`)

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user) {
        console.log('User NOT FOUND')
        return
    }

    console.log('User found:', user.id)
    console.log('Role:', user.role)
    console.log('Stored Hash:', user.passwordHash)
    console.log('isFirstLogin:', user.isFirstLogin)
    console.log('onboardingCompleted:', user.onboardingCompleted)
    console.log('onboardingStep:', user.onboardingStep)

    const match = await bcrypt.compare(password, user.passwordHash)
    console.log('Password match:', match)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
