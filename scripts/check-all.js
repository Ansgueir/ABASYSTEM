const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- SYSTEM WIDE AUDIT ---')
  const totalStudents = await prisma.student.count()
  const totalSupers = await prisma.supervisor.count()
  const totalAssignments = await prisma.studentSupervisor.count()
  const supHoursTotal = await prisma.supervisionHour.count()
  const indHoursTotal = await prisma.independentHour.count()

  console.log(`Students: ${totalStudents}`)
  console.log(`Supervisors: ${totalSupers}`)
  console.log(`N:M Assignments: ${totalAssignments}`)
  console.log(`Global Supervised Hours: ${supHoursTotal}`)
  console.log(`Global Independent Hours: ${indHoursTotal}`)
  
  // Check the 2 students with hours
  const studentsWithHours = await prisma.supervisionHour.findMany({ select: { studentId: true }, distinct: ['studentId'] })
  for (const sh of studentsWithHours) {
    const s = await prisma.student.findUnique({ where: { id: sh.studentId }, include: { supervisors: { include: { supervisor: true } } } })
    console.log(`- Student ${s.fullName} (ID ${s.id.substring(0,8)}) has hours. Assigned to NM Supers: ${s.supervisors.map(a => a.supervisor.fullName).join(', ') || 'NONE'}. Legacy Super: ${s.supervisorId || 'NONE'}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
