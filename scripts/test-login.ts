
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'testsuperoffice@abasystem.com'
    const password = '1Qa2ws3ed.2026'

    console.log(`Checking user: ${email}`)

    const user = await prisma.user.findUnique({
        where: { email },
    })

    if (!user) {
        console.log('User NOT FOUND')
        return
    }

    console.log('User found:', user.id)
    console.log('Stored Hash:', user.passwordHash || (user as any).password_hash)
    
    const hashToTest = user.passwordHash || (user as any).password_hash

    if(hashToTest) {
        const match = await bcrypt.compare(password, hashToTest)
        console.log('Password match:', match)
    } else {
        console.log('No password hash found on user object')
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
