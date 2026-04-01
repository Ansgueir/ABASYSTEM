const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('--- BACKFILLING GROUP HOURS ---')
  
  const attendances = await prisma.groupSupervisionAttendance.findMany({
    where: { attended: true },
    include: {
      session: true,
      student: true
    }
  })

  console.log(`Found ${attendances.length} group attendances to check.`)

  let createdCount = 0
  let skippedCount = 0

  for (const att of attendances) {
    const { session, studentId } = att
    
    // Check if hour already exists
    const existing = await prisma.supervisionHour.findFirst({
      where: {
        studentId: studentId,
        date: session.date,
        startTime: session.startTime,
        supervisionType: 'GROUP'
      }
    })

    if (!existing) {
      await prisma.supervisionHour.create({
        data: {
          studentId: studentId,
          supervisorId: session.supervisorId,
          date: session.date,
          startTime: session.startTime,
          hours: 1.0, // Default for backfill
          supervisionType: 'GROUP',
          setting: 'OFFICE_CLINIC',
          activityType: 'RESTRICTED',
          notes: `Group Session: ${session.topic} (Backfilled)`,
          groupTopic: session.topic,
          status: 'PENDING'
        }
      })
      createdCount++
    } else {
      skippedCount++
    }
  }

  console.log(`--- FINISHED ---`)
  console.log(`Created: ${createdCount}`)
  console.log(`Skipped (already exist): ${skippedCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
