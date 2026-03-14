const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { _count: { select: { logs: true } } }
  })
  
  console.log('--- Last 5 Batches ---')
  batches.forEach(b => {
    console.log(`ID: ${b.id}, String: ${b.batchString}, Created: ${b.createdAt}, Reverted: ${b.revertedAt}, Logs: ${b._count.logs}`)
  })

  const logs = await prisma.importLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  })

  console.log('\n--- Last 20 Logs ---')
  logs.forEach(l => {
    console.log(`Batch: ${l.batchId}, Table: ${l.tableName}, Action: ${l.action}, RecordId: ${l.recordId}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
