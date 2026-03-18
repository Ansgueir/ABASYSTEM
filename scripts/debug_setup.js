const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- DEBUGGING SUPERVISOR CREATION ---')
        const user = await prisma.user.findUnique({ where: { email: 'qasupervisor@abasystem.com' } })
        console.log('User found:', user ? user.id : 'NOT FOUND')
        
        if (!user) return;

        const profile = await prisma.supervisor.upsert({
            where: { userId: user.id },
            update: {},
            create: {
                userId: user.id,
                fullName: 'QA Supervisor',
                email: 'qasupervisor@abasystem.com',
                phone: '555-000-0000',
                address: '123 QA St',
                bacbId: 'QA-SUP-001',
                certificantNumber: 'CERT-001',
                availableDaysGroup: [],
                status: 'ACTIVE',
                credentialType: 'BCBA',
                maxStudents: 10
            }
        })
        console.log('Profile created/updated:', profile.id)
    } catch (e) {
        console.error('FULL ERROR:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
