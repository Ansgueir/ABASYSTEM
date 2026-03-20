const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('SYNC: Legacy -> N:M')
  const students = await prisma.student.findMany({ where: { supervisorId: { not: null } } })
  console.log(`Found ${students.length} students.`)
  let count = 0
  for (const s of students) {
    const existing = await prisma.studentSupervisor.findUnique({
      where: {
        studentId_supervisorId: {
          studentId: s.id,
          supervisorId: s.supervisorId
        }
      }
    })
    if (!existing) {
      await prisma.studentSupervisor.create({
        data: {
          studentId: s.id,
          supervisorId: s.supervisorId,
          isPrimary: true
        }
      })
      count++
    }
  }
  console.log(`Synced ${count} records.`)
}
main().catch(console.error).finally(() => prisma.$disconnect())
