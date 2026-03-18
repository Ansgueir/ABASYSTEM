import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const contracts = await prisma.contract.findMany({
    include: {
      student: true
    }
  })
  console.log(JSON.stringify(contracts, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
