const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  console.log(`Checking hours for: ${email}`)
  
  const supervisor = await prisma.supervisor.findFirst({
    where: { email },
    include: {
      studentAssignments: true,
      students: true
    }
  })

  if (!supervisor) {
    console.log('Supervisor not found.')
    return
  }

  const nmIds = supervisor.studentAssignments.map(a => a.studentId)
  const legacyIds = supervisor.students.map(s => s.id)
  const allAssignedIds = Array.from(new Set([...nmIds, ...legacyIds]))

  console.log(`Assignation count: ${allAssignedIds.length}`)

  const start = new Date('2026-03-01')
  
  const superHours = await prisma.supervisionHour.findMany({
    where: {
      studentId: { in: allAssignedIds },
      date: { gte: start }
    }
  })

  const indepHours = await prisma.independentHour.findMany({
    where: {
      studentId: { in: allAssignedIds },
      date: { gte: start }
    }
  })

  console.log(`Monthly Supervised Entries: ${superHours.length}`)
  console.log(`Monthly Independent Entries: ${indepHours.length}`)
  
  const totalHours = superHours.reduce((acc, h) => acc + Number(h.hours), 0) + indepHours.reduce((acc, h) => acc + Number(h.hours), 0)
  console.log(`Total Hours March: ${totalHours}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
