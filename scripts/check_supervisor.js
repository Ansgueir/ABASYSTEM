const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- CHECKING SUPERVISOR TABLE ---')
        const supervisors = await prisma.supervisor.findMany({ take: 5 })
        if (supervisors.length > 0) {
            const first = supervisors[0];
            console.log('Searching by userId:', first.userId)
            const found = await prisma.supervisor.findUnique({
                where: { userId: first.userId }
            })
            console.log('Search by userId Result:', found ? 'SUCCESS' : 'NOT FOUND')
            
            console.log('Searching by email:', first.email)
            const foundByEmail = await prisma.supervisor.findFirst({
                where: { email: first.email }
            })
            console.log('Search by email Result:', foundByEmail ? 'SUCCESS' : 'NOT FOUND')
        }
    } catch (e) {
        console.error('ERROR:', e.message || e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
