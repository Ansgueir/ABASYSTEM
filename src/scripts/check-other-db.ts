
import { PrismaClient } from '@prisma/client'

// Manually specify the other DB URL
const otherUrl = "postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_system?schema=public"
const prisma = new PrismaClient({
  datasources: {
    db: { url: otherUrl }
  }
})

async function main() {
  try {
    const s = await prisma.student.count()
    const u = await prisma.user.count()
    console.log(`aba_system -> Students: ${s}, Users: ${u}`)
  } catch (e) {
    console.error('Failed to read aba_system:', e.message)
  }
}

main().finally(() => prisma.$disconnect())
