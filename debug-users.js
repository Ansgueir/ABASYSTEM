const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Fetching users...')
    const users = await prisma.user.findMany({
        select: { email: true, role: true, id: true }
    })

    console.log('--- USERS ---')
    console.table(users)
    console.log('-------------')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
