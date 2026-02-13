
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Checking recent independent hours...")
    const hours = await prisma.independentHour.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    })
    console.log("Recent Independent Hours:", hours)

    console.log("Checking recent supervision hours...")
    const sHours = await prisma.supervisionHour.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    })
    console.log("Recent Supervision Hours:", sHours)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
