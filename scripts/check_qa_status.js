const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- CHECKING QA SUPERVISOR USER ---')
        const user = await prisma.user.findUnique({ where: { email: 'qasupervisor@abasystem.com' } })
        console.log('User found:', user ? user.id : 'NOT FOUND')
        
        if (user) {
            console.log('Role:', user.role)
            const profile = await prisma.supervisor.findUnique({
                where: { userId: user.id }
            })
            console.log('Supervisor Profile:', profile ? 'EXISTS' : 'NOT FOUND')
            if (profile) {
                console.log('Profile details:', profile)
            }
        }
    } catch (e) {
        console.error('ERROR:', e.message || e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
