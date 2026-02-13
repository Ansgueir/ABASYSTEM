import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'qa@abasystem.com'
    const password = 'qa-password-123'
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log(`Creating QA user: ${email}`)

    // 1. Create User
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            role: UserRole.QA,
            passwordHash: hashedPassword,
        },
        create: {
            email,
            passwordHash: hashedPassword,
            role: UserRole.QA,
        }
    })

    console.log(`User created/updated: ${user.id}`)

    // 2. Create Student Profile
    const student = await prisma.student.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            fullName: 'QA Student Profile',
            paymentAlias: ['QA Student'],
            bacbId: 'QA-STU-001',
            credential: 'RBT',
            school: 'QA University',
            level: 'BCaBA',
            phone: '555-0101',
            email: 'qa.student@example.com',
            city: 'Test City',
            state: 'TS',
            startDate: new Date(),
            supervisionType: 'REGULAR',
            supervisionPercentage: 0.05,
            hoursToDo: 130,
            hoursToPay: 0,
            amountToPay: 0,
            hoursPerMonth: 130,
            totalMonths: 12,
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            status: 'ACTIVE',
            availableDaysGroup: ['Monday', 'Friday'],
        }
    })
    console.log(`Student profile created: ${student.id}`)

    // 3. Create Supervisor Profile
    const supervisor = await prisma.supervisor.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            fullName: 'QA Supervisor Profile',
            phone: '555-0102',
            email: 'qa.supervisor@example.com',
            address: '123 QA Lane',
            bacbId: 'QA-SUP-001',
            certificantNumber: 'CERT-001',
            credentialType: 'BCBA',
            maxStudents: 20,
            status: 'ACTIVE',
            canEnterGroupHours: true,
        }
    })
    console.log(`Supervisor profile created: ${supervisor.id}`)

    // 4. Create Office Profile
    const office = await prisma.officeMember.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            fullName: 'QA Office Admin',
            permissions: { all: true }
        }
    })
    console.log(`Office profile created: ${office.id}`)

    console.log('QA User setup complete.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
