const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DB SEED (JS): Test Users ---')
    const password = '1Qa2ws3ed.2026'
    const hashedPassword = await bcrypt.hash(password, 10)

    const testUsers = [
        {
            email: 'testestudiante@abasystem.com',
            fullName: 'Test Student',
            role: 'STUDENT',
            createFn: async (userId, email) => {
                await prisma.student.upsert({
                    where: { userId },
                    update: {},
                    create: {
                        userId, email, fullName: 'Test Student',
                        phone: '123456', address: 'Test', level: 'BCBA_STUDENT', status: 'ACTIVE'
                    }
                })
            }
        },
        {
            email: 'testsupervisor@abasystem.com',
            fullName: 'Test Supervisor',
            role: 'SUPERVISOR',
            createFn: async (userId, email) => {
                await prisma.supervisor.upsert({
                    where: { userId },
                    update: {},
                    create: {
                        userId, email, fullName: 'Test Supervisor',
                        phone: '123456', certType: 'BCBA', certNumber: 'T-SUP-001', 
                        paymentPercentage: 0.54, status: 'ACTIVE'
                    }
                })
            }
        },
        {
            email: 'testoffice@abasystem.com',
            fullName: 'Test Office Standard',
            role: 'OFFICE',
            createFn: async (userId, email) => {
                await prisma.officeMember.upsert({
                    where: { userId },
                    update: {},
                    create: {
                        userId, email, fullName: 'Test Office Standard',
                        officeRole: 'ADMIN'
                    }
                })
            }
        },
        {
            email: 'testsuperoffice@abasystem.com',
            fullName: 'Test Super Office',
            role: 'OFFICE',
            createFn: async (userId, email) => {
                await prisma.officeMember.upsert({
                    where: { userId },
                    update: {},
                    create: {
                        userId, email, fullName: 'Test Super Office',
                        officeRole: 'SUPER_ADMIN'
                    }
                })
            }
        }
    ]

    for (const u of testUsers) {
        console.log(`Processing: ${u.email}...`)
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { password: hashedPassword, role: u.role },
            create: { email: u.email, fullName: u.fullName, password: hashedPassword, role: u.role }
        })
        await u.createFn(user.id, u.email)
        console.log(`Done: ${u.email}`)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
