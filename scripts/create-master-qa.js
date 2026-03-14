const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    console.log('--- CREATING QA MASTER USER ---')
    const email = 'qa-super@abasystem.com'
    const password = '#qa$ws%ed.2026'
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
        where: { email },
        update: { role: 'OFFICE', passwordHash, isActive: true, onboardingCompleted: true, isFirstLogin: false },
        create: {
            email,
            passwordHash,
            role: 'OFFICE',
            isActive: true,
            onboardingCompleted: true,
            isFirstLogin: false
        }
    })

    await prisma.officeMember.upsert({
        where: { userId: user.id },
        update: { officeRole: 'SUPER_ADMIN' },
        create: {
            userId: user.id,
            fullName: 'QA Super Admin',
            officeRole: 'SUPER_ADMIN'
        }
    })

    console.log('✅ QA Master User OK:', email)
}

main()
    .catch(e => { console.error('ERROR:', e); process.exit(1); })
    .finally(async () => await prisma.$disconnect())
