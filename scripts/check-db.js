const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const count = await prisma.supervisionHour.count({
    where: { supervisionType: 'GROUP' }
  })
  console.log(`TOTAL GROUP HOURS IN DB: ${count}`)
  
  const sample = await prisma.supervisionHour.findMany({
    where: { supervisionType: 'GROUP' },
    take: 5,
    include: { student: true, supervisor: true }
  })
  console.log('SAMPLE:', JSON.stringify(sample, null, 2))
}

main().finally(() => prisma.$disconnect())
