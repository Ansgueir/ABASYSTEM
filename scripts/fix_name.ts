import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const settings = await prisma.generalValues.findMany()

    for (const s of settings) {
        if (s.companyName.includes('Clinic')) {
            await prisma.generalValues.update({
                where: { id: s.id },
                data: {
                    companyName: s.companyName.replace('Clinic', 'System'),
                    companyEmail: s.companyEmail.replace('clinic', 'system'),
                    companyWebsite: s.companyWebsite.replace('clinic', 'system'),
                }
            })
            console.log(`Updated setting: ${s.id}`)
        }
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
