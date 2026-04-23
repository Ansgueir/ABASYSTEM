
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

  // Find ALL students and filter in JS for maximum flexibility
  const allStudents = await prisma.student.findMany({
    select: { userId: true, fullName: true, email: true }
  })

  const residues = allStudents.filter(s => 
    s.fullName.toLowerCase().includes('mayte') ||
    s.fullName.toLowerCase().includes('mesa villavicencio') ||
    s.fullName.toLowerCase().includes('blanco quesada') ||
    s.fullName.toLowerCase().includes('lucia del sol') ||
    s.email.toLowerCase().includes('matoslaura') ||
    s.email.toLowerCase().includes('delsol.amanda')
  )

  const userIds = new Set([
    ...residues.map(s => s.userId)
  ])

  // Also check User table directly for those emails
  const usersDirect = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: 'matoslaura', mode: 'insensitive' } },
        { email: { contains: 'delsol.amanda', mode: 'insensitive' } }
      ]
    }
  })
  
  for(const u of usersDirect) userIds.add(u.id)

  console.log(`Found ${userIds.size} residue users to delete.`)
  for (const u of residues) console.log(`Targeting: ${u.fullName} (${u.email})`)

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
