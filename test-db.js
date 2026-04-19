const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const students = await prisma.student.findMany({
    include: {
        supervisors: true,
        contracts: { include: { groupAssignments: true } }
    }
  })
  console.log("Students:", JSON.stringify(students, null, 2))
  
  const sessions = await prisma.groupSupervisionSession.findMany({
    include: { attendance: true }
  })
  console.log("Sessions:", JSON.stringify(sessions, null, 2))
}
main().catch(console.error).finally(() => prisma.$disconnect())
