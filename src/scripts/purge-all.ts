
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- STARTING TOTAL PURGE (CLEAN SLATE) ---')

  try {
    // 1. Delete all activity records (same as reset API)
    await prisma.groupSupervisionAttendance.deleteMany({})
    await prisma.groupSupervisionSession.deleteMany({})
    await prisma.supervisorLedgerEntry.deleteMany({})
    await prisma.supervisorPayout.deleteMany({})
    await prisma.supervisionHour.deleteMany({})
    await prisma.independentHour.deleteMany({})
    await prisma.invoice.deleteMany({})
    await prisma.studentPayment.deleteMany({})
    await prisma.supervisorPayment.deleteMany({})
    await prisma.studentEvaluation.deleteMany({})
    await prisma.repeatingSchedule.deleteMany({})
    await prisma.importLog.deleteMany({})
    await prisma.importBatch.deleteMany({})
    await prisma.auditLog.deleteMany({})
    await prisma.notification.deleteMany({})
    await prisma.contractSupervisor.deleteMany({})
    await prisma.contractGroupAssignment.deleteMany({})
    await prisma.contract.deleteMany({})
    await prisma.groupStudent.deleteMany({})
    await prisma.financialPeriod.deleteMany({})
    await prisma.studentSupervisor.deleteMany({})
    
    console.log('Activity records purged.')

    // 2. Find all students and supervisors to delete their users
    const students = await prisma.student.findMany({ select: { userId: true } })
    const supervisors = await prisma.supervisor.findMany({ select: { userId: true } })
    
    const userIdsToPurge = new Set([
      ...students.map(s => s.userId),
      ...supervisors.map(s => s.userId)
    ])

    console.log(`Deleting ${userIdsToPurge.size} user profiles (Students & Supervisors)...`)

    // 3. Delete Student and Supervisor profiles first
    await prisma.student.deleteMany({})
    await prisma.supervisor.deleteMany({})

    // 4. Delete Users
    if (userIdsToPurge.size > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: Array.from(userIdsToPurge) },
          role: { in: ['STUDENT', 'SUPERVISOR'] } // Protection: only students and supervisors
        }
      })
    }

    console.log('--- PURGE COMPLETE. DATABASE IS CLEAN ---')
  } catch (error) {
    console.error('PURGE FAILED:', error)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
