import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Listing import batches...')
  try {
    const batches = await (prisma as any).importBatch.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    })
    console.log(JSON.stringify(batches, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
