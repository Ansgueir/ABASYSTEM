
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- STARTING GHOST USER PURGE ---')

  try {
    // 1. Delete all Student and Supervisor profiles first (just in case)
    await prisma.student.deleteMany({})
    await prisma.supervisor.deleteMany({})
    console.log('Profiles cleared.')

    // 2. Delete ALL users with STUDENT or SUPERVISOR role
    // This catches "ghost" users without profiles
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { in: ['STUDENT', 'SUPERVISOR'] },
        // Protection: do not delete the QA super admin
        NOT: { email: 'qa-super@abasystem.com' }
      }
    })

    console.log(`Deleted ${deletedUsers.count} ghost/orphaned users.`)

    // 3. Explicit check for the problematic ones in the screenshot
    const specificEmails = [
      'matoslaura997@gmail.com',
      'delsol.amanda@yahoo.es'
    ]
    
    // Check if they are still there (maybe they have a different role?)
    const stillThere = await prisma.user.findMany({
      where: { email: { in: specificEmails } }
    })
    
    if (stillThere.length > 0) {
      console.log(`Warning: ${stillThere.length} users still exist even after role purge. Deleting them by email...`)
      await prisma.user.deleteMany({
        where: { email: { in: specificEmails } }
      })
    }

    console.log('--- GHOST PURGE COMPLETE ---')
  } catch (error) {
    console.error('GHOST PURGE FAILED:', error)
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
