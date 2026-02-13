import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const passwordHash = await bcrypt.hash('password123', 10)

    const maria = await prisma.user.upsert({
        where: { email: 'maria@example.com' },
        update: {},
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

    console.log({ maria })
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
