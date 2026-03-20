const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- HOURS AUDIT ---')
  const supEntries = await prisma.supervisionHour.findMany({ include: { student: true, supervisor: true } })
  const indEntries = await prisma.independentHour.findMany({ include: { student: true } })

  console.log(`Found ${supEntries.length} Supervised entries.`)
  supEntries.forEach(h => {
    console.log(`[SUP] Student: ${h.student.fullName} (ID: ${h.student.id.substring(0,8)}) | Sup: ${h.supervisor?.fullName || 'NULL'} | Hours: ${h.hours} | Date: ${h.date.toISOString()}`)
  })

  console.log(`Found ${indEntries.length} Independent entries.`)
  indEntries.forEach(h => {
    console.log(`[IND] Student: ${h.student.fullName} (ID: ${h.student.id.substring(0,8)}) | Hours: ${h.hours} | Date: ${h.date.toISOString()}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
