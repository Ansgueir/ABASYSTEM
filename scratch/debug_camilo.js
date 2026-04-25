const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const student = await prisma.student.findFirst({
    where: { fullName: { contains: 'Camilo', mode: 'insensitive' } },
    include: {
      invoices: {
        include: {
          supervisionHours: true,
          ledgerEntries: true
        }
      }
    }
  })

  if (!student) {
    console.log('Student not found')
    return
  }

  console.log(`Student: ${student.fullName} (${student.id})`)
  for (const inv of student.invoices) {
    console.log(`Invoice: ${inv.id}, Amount: ${inv.amountDue}, Date: ${inv.invoiceDate}`)
    const groupHours = inv.supervisionHours.filter(h => h.supervisionType === 'GROUP')
    const individualHours = inv.supervisionHours.filter(h => h.supervisionType === 'INDIVIDUAL')
    console.log(`  - Individual Hours: ${individualHours.length}`)
    console.log(`  - Group Hours: ${groupHours.length}`)
    for (const h of inv.supervisionHours) {
        console.log(`    * Type: ${h.supervisionType}, Amount Billed: ${h.amountBilled}`)
    }
    for (const entry of inv.ledgerEntries) {
        console.log(`  - Ledger Entry: ${entry.id}`)
        console.log(`    * paymentFromStudent: ${entry.paymentFromStudent}`)
        console.log(`    * supervisorPayout: ${entry.supervisorPayout}`)
        console.log(`    * officePayout: ${entry.officePayout}`)
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
