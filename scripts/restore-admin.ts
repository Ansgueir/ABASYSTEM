
import { PrismaClient, UserRole, OfficeRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'testsuperoffice@abasystem.com'
    const password = '1Qa2ws3ed.2026'
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log('Restoring Admin user...')

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            passwordHash: hashedPassword,
            role: 'OFFICE' as UserRole
        },
        create: {
            email,
            passwordHash: hashedPassword,
            role: 'OFFICE' as UserRole,
            officeMember: {
                create: {
                    fullName: 'Super Office Admin',
                    officeRole: 'SUPER_ADMIN' as OfficeRole
                }
            }
        }
    })

    console.log('✅ Admin restored:', user.email)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
