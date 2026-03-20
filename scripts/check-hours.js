const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  console.log(`Checking ALL hours for students of: ${email}`)
  
  const supervisor = await prisma.supervisor.findFirst({
    where: { email },
    include: {
      studentAssignments: true,
      students: true
    }
  })

  const nmIds = supervisor.studentAssignments.map(a => a.studentId)
  const legacyIds = supervisor.students.map(s => s.id)
  const allAssignedIds = Array.from(new Set([...nmIds, ...legacyIds]))

  console.log(`Assignation count: ${allAssignedIds.length}`)

  const superHours = await prisma.supervisionHour.findMany({
    where: { studentId: { in: allAssignedIds } }
  })
  const indepHours = await prisma.independentHour.findMany({
    where: { studentId: { in: allAssignedIds } }
  })

  console.log(`Global Supervised Entries: ${superHours.length}`)
  console.log(`Global Independent Entries: ${indepHours.length}`)
  
  if (superHours.length > 0) {
    console.log(`Example dates: ${superHours.slice(0, 3).map(h => h.date).join(', ')}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
