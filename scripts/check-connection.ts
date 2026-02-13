import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log("Testing DB connection...")
    try {
        const count = await prisma.user.count()
        console.log("✅ Connection Successful!")
        console.log("User count:", count)

        const users = await prisma.user.findMany()
        console.log("Users:", JSON.stringify(users, null, 2))

    } catch (error) {
        console.error("❌ DB Connection Failed:")
        console.error(error)
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
