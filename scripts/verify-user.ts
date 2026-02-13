import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log("Checking for user maria@example.com...")
    const user = await prisma.user.findUnique({
        where: { email: 'maria@example.com' },
    })

    if (!user) {
        console.log("❌ User NOT found in database.")
    } else {
        console.log("✅ User found:", user.email)
        console.log("   Role:", user.role)
        console.log("   Hash:", user.password_hash)

        const isMatch = await bcrypt.compare('password123', user.password_hash)
        console.log("   Password 'password123' match?", isMatch ? "YES" : "NO")
    }
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
    })
