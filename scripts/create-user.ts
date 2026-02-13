import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log("Attempting to create/verify user maria@example.com...")

    try {
        const passwordHash = await bcrypt.hash('password123', 10)

        const maria = await prisma.user.upsert({
            where: { email: 'maria@example.com' },
            update: {
                password_hash: passwordHash // Update password just in case
            },
            create: {
                email: 'maria@example.com',
                password_hash: passwordHash,
                role: 'student',
                student: {
                    create: {
                        full_name: 'Maria Rodriguez',
                        bacb_id: '12345678',
                        level: 'BCaBA',
                        supervision_type: 'concentrated',
                        supervision_percentage: 0.10,
                        hours_per_month: 130,
                        start_date: new Date(),
                        status: 'active'
                    }
                }
            },
        })

        console.log("✅ SUCCESS: User 'maria@example.com' exists with ID:", maria.id)
        console.log("✅ Password set to: 'password123'")

    } catch (error) {
        console.error("❌ ERROR creating user:", error)
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
