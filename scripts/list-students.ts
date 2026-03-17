import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Listing latest 10 students...')
  try {
    const students = await (prisma as any).student.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, fullName: true, email: true }
    })
    console.log(JSON.stringify(students, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
