import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Starting data migration: Syncing legacy supervisor assignments to N:M table...')
  
  const students = await prisma.student.findMany({
    where: {
      supervisorId: { not: null }
    }
  })

  console.log(`Found ${students.length} students with legacy supervisor assignments.`)

  let count = 0
  for (const student of students) {
    if (!student.supervisorId) continue

    // Check if assignment already exists
    const existing = await prisma.studentSupervisor.findFirst({
      where: {
        studentId: student.id,
        supervisorId: student.supervisorId
      }
    })

    if (!existing) {
      await prisma.studentSupervisor.create({
        data: {
          studentId: student.id,
          supervisorId: student.supervisorId,
          isPrimary: true
        }
      })
      count++
    }
  }

  console.log(`Migration complete. Created ${count} new N:M assignment records.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
