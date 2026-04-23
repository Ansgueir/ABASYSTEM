
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const emails = [
    'matoslaura997@gmail.com',
    'delsol.amanda@yahoo.es'
  ]
  const names = [
    'Marcos Ulices Mesa Villavicencio',
    'Linet Blanco Quesada'
  ]

  console.log('Cleaning residues...')

  // Find users by email
  const usersByEmail = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true }
  })

  // Find students by name
  const studentsByName = await prisma.student.findMany({
    where: { fullName: { in: names } },
    select: { userId: true, fullName: true }
  })

  const userIds = new Set([
    ...usersByEmail.map(u => u.id),
    ...studentsByName.map(s => s.userId)
  ])

  console.log(`Found ${userIds.size} residue users to delete.`)

  for (const userId of userIds) {
    try {
      // Delete user (cascade will handle student, but let's be explicit if needed)
      await prisma.user.delete({ where: { id: userId } })
      console.log(`Deleted user ${userId}`)
    } catch (e) {
      console.error(`Error deleting user ${userId}:`, e)
    }
  }

  console.log('Residues cleaned.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
