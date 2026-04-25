const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const pending = await prisma.supervisionHour.findMany({
    where: { studentId: '9bfcddd9-bd04-4231-ae3e-b1d9f7939c34', status: 'PENDING' }
  })
  
  console.log('\nPENDING LOGS:')
  console.log(JSON.stringify(pending.map(p => ({ date: p.date, hours: p.hours })), null, 2))
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
