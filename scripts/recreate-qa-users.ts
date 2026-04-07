
import { PrismaClient, UserRole, OfficeRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const password = '1Qa2ws3ed.2026'
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log('Restoring QA Users...')

    // 1. QA Estudiante
    const qaEstudiante = await prisma.user.upsert({
        where: { email: 'qaestudiante@abasystem.com' },
        update: { passwordHash: hashedPassword, role: 'STUDENT' as UserRole },
        create: {
            email: 'qaestudiante@abasystem.com',
            passwordHash: hashedPassword,
            role: 'STUDENT' as UserRole,
            student: {
                create: {
                    fullName: 'QA Estudiante',
                    paymentAlias: ['QA Student'],
                    bacbId: 'QA-ST-001',
                    credential: 'RBT',
                    school: 'QA Academy',
                    level: 'BCaBA',
                    phone: '555-QA-STUD',
                    email: 'qaestudiante@abasystem.com',
                    city: 'QA City',
                    state: 'QA',
                    startDate: new Date(),
                    supervisionType: 'REGULAR',
                    supervisionPercentage: 0.05,
                    hoursToDo: 130,
                    hoursToPay: 0,
                    amountToPay: 0,
                    hourlyRate: 0,
                    hoursPerMonth: 130,
                    totalMonths: 12,
                    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
                    status: 'ACTIVE',
                    availableDaysGroup: ['Monday', 'Wednesday']
                }
            }
        }
    })
    console.log('✅ QA Estudiante restored')

    // 2. QA Supervisor
    const qaSupervisor = await prisma.user.upsert({
        where: { email: 'qasupervisor@abasystem.com' },
        update: { passwordHash: hashedPassword, role: 'SUPERVISOR' as UserRole },
        create: {
            email: 'qasupervisor@abasystem.com',
            passwordHash: hashedPassword,
            role: 'SUPERVISOR' as UserRole,
            supervisor: {
                create: {
                    fullName: 'QA Supervisor',
                    phone: '555-QA-SUPV',
                    email: 'qasupervisor@abasystem.com',
                    address: 'QA Clinic 123',
                    bacbId: 'QA-SP-001',
                    certificantNumber: 'CRT-QA-1',
                    credentialType: 'BCBA',
                    maxStudents: 15,
                    status: 'ACTIVE',
                    canEnterGroupHours: true
                }
            }
        }
    })
    console.log('✅ QA Supervisor restored')

    // 3. QA Office (Admin)
    const qaOffice = await prisma.user.upsert({
        where: { email: 'qaoffice@abasystem.com' },
        update: { passwordHash: hashedPassword, role: 'OFFICE' as UserRole },
        create: {
            email: 'qaoffice@abasystem.com',
            passwordHash: hashedPassword,
            role: 'OFFICE' as UserRole,
            officeMember: {
                create: {
                    fullName: 'QA Office Standard',
                    officeRole: 'ADMIN' as OfficeRole
                }
            }
        }
    })
    console.log('✅ QA Office restored')

    // 4. QA Super Admin
    const qaSuper = await prisma.user.upsert({
        where: { email: 'qa-super@abasystem.com' },
        update: { passwordHash: hashedPassword, role: 'OFFICE' as UserRole },
        create: {
            email: 'qa-super@abasystem.com',
            passwordHash: hashedPassword,
            role: 'OFFICE' as UserRole,
            officeMember: {
                create: {
                    fullName: 'QA Super Office',
                    officeRole: 'SUPER_ADMIN' as OfficeRole
                }
            }
        }
    })
    console.log('✅ QA Super Admin restored')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
