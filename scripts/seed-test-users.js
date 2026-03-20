const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DB SEED (Full Profiles): Test Users ---')
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
                    update: { status: 'ACTIVE' },
                    create: {
                        userId, 
                        email, 
                        fullName: 'Test Student',
                        phone: '123456789', 
                        address: 'Test Student St 1', 
                        city: 'Miami',
                        state: 'FL',
                        bacbId: 'T-STD-001',
                        credential: 'RBT',
                        school: 'ABA Board',
                        level: 'BCBA', 
                        startDate: new Date(),
                        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                        supervisionType: 'REGULAR',
                        supervisionPercentage: 0.05,
                        hoursToDo: 2000,
                        hoursToPay: 0,
                        amountToPay: 0,
                        hoursPerMonth: 130,
                        totalMonths: 18,
                        status: 'ACTIVE'
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
                    update: { status: 'ACTIVE' },
                    create: {
                        userId, 
                        email, 
                        fullName: 'Test Supervisor',
                        phone: '987654321',
                        address: '99 Supervisor Rd',
                        bacbId: 'T-SUP-001',
                        certificantNumber: '1-23-45678',
                        status: 'ACTIVE',
                        paymentPercentage: 0.54,
                        credentialType: 'BCBA'
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
                    update: { officeRole: 'ADMIN' },
                    create: {
                        userId, 
                        fullName: 'Test Office Standard',
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
                    update: { officeRole: 'SUPER_ADMIN' },
                    create: {
                        userId, 
                        fullName: 'Test Super Office',
                        officeRole: 'SUPER_ADMIN'
                    }
                })
            }
        }
    ]

    for (const u of testUsers) {
        console.log(`Processing: ${u.email}...`)
        
        try {
            const user = await prisma.user.upsert({
                where: { email: u.email },
                update: { 
                    passwordHash: hashedPassword, 
                    role: u.role 
                },
                create: { 
                    email: u.email, 
                    passwordHash: hashedPassword, 
                    role: u.role 
                }
            })
            
            await u.createFn(user.id, u.email)
            console.log(`Done: ${u.email}`)
        } catch (err) {
            console.error(`Error processing ${u.email}:`, err.message)
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
