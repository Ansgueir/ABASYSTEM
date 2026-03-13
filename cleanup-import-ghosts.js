// cleanup-import-ghosts.js
// Purges ghosted accounts that were soft-deleted by the old import undo logic.
// Criteria: isHidden=true AND (email contains @pending.import OR student.importBatchId is not null)

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  console.log('=== Import Ghost Cleanup ===')

  const ghostedUsers = await p.user.findMany({
    where: { isHidden: true },
    include: { student: true }
  })

  const toDelete = ghostedUsers.filter(u =>
    u.email.includes('@pending.import') ||
    (u.student && u.student.importBatchId)
  )

  console.log(`Found ${ghostedUsers.length} total ghosted users`)
  console.log(`Found ${toDelete.length} import-generated ghosted users to purge`)
  toDelete.forEach(u => console.log(`  - [${u.id}] ${u.email}`))

  if (toDelete.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  // Hard delete each — must delete Student record first due to FK constraint
  let deleted = 0
  for (const u of toDelete) {
    try {
      // Delete student profile first (FK: Student.userId -> User.id)
      if (u.student) {
        await p.student.delete({ where: { id: u.student.id } })
      }
      await p.user.delete({ where: { id: u.id } })
      deleted++
    } catch (e) {
      console.error(`  Failed to delete ${u.email}:`, e.message)
    }
  }

  console.log(`\n✅ Purged ${deleted} of ${toDelete.length} ghosted import users.`)
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
