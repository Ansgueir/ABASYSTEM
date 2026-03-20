const { PrismaClient, UserRole, OfficeRole } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
    console.log('--- DB SEED: Test Users (Strict RBAC) ---')
    const password = '1Qa2ws3ed.2026'
    const hashedPassword = await bcrypt.hash(password, 10)

    const testUsers = [
        {
            email: 'testestudiante@abasystem.com',
            fullName: 'Test Student',
            role: 'STUDENT',
            profile: {
                create: {
                    fullName: 'Test Student',
                    phone: '123456789',
                    address: 'Test Addr',
                    level: 'BCBA_STUDENT',
                    status: 'ACTIVE',
                    bacbId: 'T-STD-001'
                }
            }
        },
        {
            email: 'testsupervisor@abasystem.com',
            fullName: 'Test Supervisor',
            role: 'SUPERVISOR',
            profile: {
                create: {
                    fullName: 'Test Supervisor',
                    phone: '123456789',
                    certType: 'BCBA',
                    certNumber: 'T-SUP-001',
                    paymentPercentage: 0.54,
                    status: 'ACTIVE'
                }
            }
        },
        {
            email: 'testoffice@abasystem.com',
            fullName: 'Test Office Standard',
            role: 'OFFICE',
            profile: {
                create: {
                    fullName: 'Test Office Standard',
                    officeRole: 'ADMIN' // Standard Office
                }
            }
        },
        {
            email: 'testsuperoffice@abasystem.com',
            fullName: 'Test Super Office (No Vault Access)',
            role: 'OFFICE',
            profile: {
                create: {
                    fullName: 'Test Super Office',
                    officeRole: 'SUPER_ADMIN' // Super Office
                }
            }
        }
    ]

    for (const u of testUsers) {
        console.log(`Processing: ${u.email}...`)
        
        // 1. Upsert User
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: {
                password: hashedPassword,
                role: u.role
            },
            create: {
                email: u.email,
                fullName: u.fullName,
                password: hashedPassword,
                role: u.role
            }
        })

        // 2. Link or Create Profile
        if (u.role === 'STUDENT') {
            const existing = await prisma.student.findFirst({ where: { userId: user.id } })
            if (!existing) {
                await prisma.student.create({
                    data: {
                        ...u.profile.create,
                        userId: user.id,
                        email: u.email // Ensure email matches
                    }
                })
            }
        } else if (u.role === 'SUPERVISOR') {
            const existing = await prisma.supervisor.findFirst({ where: { userId: user.id } })
            if (!existing) {
                await prisma.supervisor.create({
                    data: {
                        ...u.profile.create,
                        userId: user.id,
                        email: u.email
                    }
                })
            }
        } else if (u.role === 'OFFICE') {
            const existing = await prisma.officeMember.findFirst({ where: { userId: user.id } })
            if (!existing) {
                await prisma.officeMember.create({
                    data: {
                        ...u.profile.create,
                        userId: user.id,
                        email: u.email
                    }
                })
            }
        }
        
        console.log(`Done: ${u.email}`)
    }

    console.log('\n--- SEED COMPLETE ---')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
