const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'qa-super@abasystem.com' },
        include: { officeMember: true }
    })
    console.log('User found:', user ? 'YES' : 'NO')
    if (user) {
        console.log('Email:', user.email)
        console.log('Role:', user.role)
        console.log('OfficeRole:', user.officeMember?.officeRole)
        console.log('isActive:', user.isActive)
        console.log('onboardingCompleted:', user.onboardingCompleted)
        console.log('isFirstLogin:', user.isFirstLogin)
    }
}

main().finally(() => prisma.$disconnect())
