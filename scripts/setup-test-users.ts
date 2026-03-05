const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    console.log('--- CREATING TEST USERS ---')

    const passwordHash = await bcrypt.hash('#qa$ws%ed.2026', 10)

    // ============================================
    // 1. TEST STUDENT
    // ============================================
    console.log('Creating Test Student...')
    const studentUser = await prisma.user.upsert({
        where: { email: 'testestudiante@abasystem.com' },
        update: { role: 'STUDENT', passwordHash },
        create: {
            email: 'testestudiante@abasystem.com',
            passwordHash,
            role: 'STUDENT'
        }
    })

    const studentProfile = await prisma.student.upsert({
        where: { userId: studentUser.id },
        update: {},
        create: {
            userId: studentUser.id,
            fullName: 'Test Estudiante',
            email: 'testestudiante@abasystem.com',
            phone: '555-000-0001',
            city: 'Test City',
            state: 'TS',
            bacbId: 'TST-STU-01',
            credential: 'RBT',
            school: 'Test University',
            level: 'BCaBA',
            startDate: new Date(),
            supervisionType: 'REGULAR',
            supervisionPercentage: 0.05,
            hoursToDo: 130,
            hoursToPay: 0,
            amountToPay: 0,
            hoursPerMonth: 130,
            totalMonths: 12,
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
        }
    })
    console.log('✅ Test Student OK:', studentUser.email)

    // ============================================
    // 2. TEST SUPERVISOR
    // ============================================
    console.log('Creating Test Supervisor...')
    const supervisorUser = await prisma.user.upsert({
        where: { email: 'testsupervisor@abasystem.com' },
        update: { role: 'SUPERVISOR', passwordHash },
        create: {
            email: 'testsupervisor@abasystem.com',
            passwordHash,
            role: 'SUPERVISOR'
        }
    })

    const supervisorProfile = await prisma.supervisor.upsert({
        where: { userId: supervisorUser.id },
        update: {},
        create: {
            userId: supervisorUser.id,
            fullName: 'Test Supervisor',
            email: 'testsupervisor@abasystem.com',
            phone: '555-000-0002',
            address: '123 Test St',
            bacbId: 'TST-SUP-001',
            certificantNumber: 'CERT-TST',
            credentialType: 'BCBA',
            maxStudents: 10,
            status: 'ACTIVE'
        }
    })
    console.log('✅ Test Supervisor OK:', supervisorUser.email)

    // ============================================
    // 3. TEST OFFICE SUPER ADMIN
    // ============================================
    console.log('Creating Test Office Super Admin...')
    const officeUser = await prisma.user.upsert({
        where: { email: 'testoffice@abasystem.com' },
        update: { role: 'OFFICE', passwordHash },
        create: {
            email: 'testoffice@abasystem.com',
            passwordHash,
            role: 'OFFICE'
        }
    })

    const officeProfile = await prisma.officeMember.upsert({
        where: { userId: officeUser.id },
        update: { officeRole: 'SUPER_ADMIN' },
        create: {
            userId: officeUser.id,
            fullName: 'Test Office Admin',
            officeRole: 'SUPER_ADMIN'
        }
    })
    console.log('✅ Test Office OK:', officeUser.email, '| Role:', officeProfile.officeRole)

    console.log('\n--- ALL TEST USERS CREATED SUCCESSFULLY ---')
}

main()
    .catch(e => {
        console.error('ERROR:', e)
        process.exit(1)
    })
    .finally(async () => await prisma.$disconnect())
