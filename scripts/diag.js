const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- GLOBAL DIAGNOSTICS ---')
  const supers = await prisma.supervisor.findMany({
    include: {
      _count: {
        select: {
          studentAssignments: true,
          students: true
        }
      }
    }
  })

  console.log(`Found ${supers.length} supervisors.`)
  supers.slice(0, 10).forEach(s => {
    console.log(`- ${s.fullName} (${s.email}): NM=${s._count.studentAssignments}, Legacy=${s._count.students}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())
