import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const students = await (prisma as any).student.findMany({
    where: {
      NOT: { supervisorId: null }
    }
  })

  console.log(`Found ${students.length} students with supervisorId.`)

  for (const student of students) {
    try {
        await (prisma as any).studentSupervisor.upsert({
            where: {
                studentId_supervisorId: {
                    studentId: student.id,
                    supervisorId: student.supervisorId
                }
            },
            update: { isPrimary: true },
            create: {
                studentId: student.id,
                supervisorId: student.supervisorId,
                isPrimary: true
            }
        })
        console.log(`Migrated student ${student.fullName}`)
    } catch (e) {
        console.error(`Error migrating student ${student.fullName}:`, e)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
