
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const student = await prisma.student.findUnique({
    where: { id: '256f00ea-baa7-4ad9-8a5a-73a55678661f' },
    include: {
        documents: true,
        contracts: true,
        independentHours: true,
        supervisionHours: true,
        invoices: true,
    }
  })
  console.log(JSON.stringify(student, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
