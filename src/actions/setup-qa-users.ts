const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
    console.log('--- STARTING QA ENVIRONMENT SETUP ---')

    const passwordHash = await bcrypt.hash('Password123!', 10)

    // ============================================
    // 1. QA SUPERVISOR
    // ============================================
    console.log('Creating QA Supervisor...')
    const supervisorUser = await prisma.user.upsert({
        where: { email: 'qasupervisor@abasystem.com' },
        update: { role: 'SUPERVISOR', passwordHash },
        create: {
            email: 'qasupervisor@abasystem.com',
            passwordHash,
            role: 'SUPERVISOR'
        }
    })

    const supervisorProfile = await prisma.supervisor.upsert({
        where: { userId: supervisorUser.id },
        update: {},
        create: {
            userId: supervisorUser.id,
            fullName: 'QA Supervisor',
            email: 'qasupervisor@abasystem.com',
            phone: '555-000-0000',
            address: '123 QA St',
            bacbId: 'QA-SUP-001',
            certificantNumber: 'CERT-001',
            credentialType: 'BCBA',
            maxStudents: 10,
            status: 'ACTIVE'
        }
    })
    console.log('✅ QA Supervisor OK:', supervisorUser.email, '| Profile ID:', supervisorProfile.id)

    // ============================================
    // 2. QA OFFICE
    // ============================================
    console.log('Creating QA Office...')
    const officeUser = await prisma.user.upsert({
        where: { email: 'qaoffice@abasystem.com' },
        update: { role: 'OFFICE', passwordHash },
        create: {
            email: 'qaoffice@abasystem.com',
            passwordHash,
            role: 'OFFICE'
        }
    })

    const officeProfile = await prisma.officeMember.upsert({
        where: { userId: officeUser.id },
        update: {},
        create: {
            userId: officeUser.id,
            fullName: 'QA Office Admin'
        }
    })
    console.log('✅ QA Office OK:', officeUser.email, '| Profile ID:', officeProfile.id)

    // ============================================
    // 3. QA STUDENT (normalize existing or create)
    // ============================================
    console.log('Setting up QA Student...')

    // Use upsert to handle existing email
    const studentUser = await prisma.user.upsert({
        where: { email: 'qaestudiante@abasystem.com' },
        update: { role: 'STUDENT', passwordHash },
        create: {
            email: 'qaestudiante@abasystem.com',
            passwordHash,
            role: 'STUDENT'
        }
    })
    console.log('  User record OK:', studentUser.email, '| Role:', studentUser.role)

    // Also check if old qa@abasystem.com exists and clean it up
    const oldQa = await prisma.user.findUnique({ where: { email: 'qa@abasystem.com' } })
    if (oldQa) {
        console.log('  Found old qa@abasystem.com user, updating role to STUDENT...')
        await prisma.user.update({
            where: { id: oldQa.id },
            data: { role: 'STUDENT', email: 'qa_old@abasystem.com' }
        })
        console.log('  Old QA user renamed to qa_old@abasystem.com')
    }

    // Create/update Student profile
    const studentProfile = await prisma.student.upsert({
        where: { userId: studentUser.id },
        update: {
            supervisorId: supervisorProfile.id,
            fullName: 'QA Estudiante'
        },
        create: {
            userId: studentUser.id,
            fullName: 'QA Estudiante',
            email: 'qaestudiante@abasystem.com',
            phone: '555-111-2222',
            city: 'Miami',
            state: 'FL',
            bacbId: 'QA-STU-01',
            credential: 'RBT',
            school: 'QA University',
            level: 'BCaBA',
            startDate: new Date(),
            supervisionType: 'REGULAR',
            supervisionPercentage: 0.05,
            hoursToDo: 130,
            hoursToPay: 0,
            amountToPay: 0,
            hoursPerMonth: 130,
            totalMonths: 12,
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            supervisorId: supervisorProfile.id
        }
    })
    console.log('✅ QA Student OK:', studentUser.email, '| Profile ID:', studentProfile.id)
    console.log('   Linked to Supervisor:', supervisorProfile.fullName)

    // ============================================
    // SUMMARY
    // ============================================
    console.log('')
    console.log('========================================')
    console.log('  QA ENVIRONMENT READY')
    console.log('========================================')
    console.log('Password for all accounts: Password123!')
    console.log('')
    console.log('1. Student:    qaestudiante@abasystem.com')
    console.log('2. Supervisor: qasupervisor@abasystem.com')
    console.log('3. Office:     qaoffice@abasystem.com')
    console.log('========================================')
}

main()
    .catch(e => {
        console.error('ERROR:', e)
        process.exit(1)
    })
    .finally(async () => await prisma.$disconnect())
