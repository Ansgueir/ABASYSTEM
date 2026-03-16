
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.$queryRaw`SELECT id, email, role FROM "User" WHERE email = 'qa-super@abasystem.com'`
  console.log('User:', users)
  
  const members = await prisma.$queryRaw`SELECT * FROM "OfficeMember" WHERE "userId" IN (SELECT id FROM "User" WHERE email = 'qa-super@abasystem.com')`
  console.log('OfficeMember:', members)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
