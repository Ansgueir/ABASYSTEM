const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const entryId = 'ab409ace-b682-4401-b296-268b75a4e728' // Camilo's entry
  
  const entry = await prisma.supervisorLedgerEntry.findUnique({ where: { id: entryId } })
  if (!entry) {
    console.log('Entry not found')
    return
  }

  console.log('Updating Camilo entry...')
  console.log('Old values:', { 
    supervisorPayout: entry.supervisorPayout, 
    officePayout: entry.officePayout,
    supervisorCapRemainingAfter: entry.supervisorCapRemainingAfter 
  })

  // Correct calculation for $300 payment on $600 invoice (60% individual)
  // Individual portion of payment = $180
  // Supervisor gets 54% of $180 = $97.20
  const correctedSupPayout = 97.20
  const correctedOfficePayout = 202.80
  const correctedCapAfter = Number(entry.supervisorCapRemainingBefore) - correctedSupPayout

  await prisma.supervisorLedgerEntry.update({
    where: { id: entryId },
    data: {
      supervisorPayout: correctedSupPayout,
      officePayout: correctedOfficePayout,
      supervisorCapRemainingAfter: correctedCapAfter
    }
  })

  console.log('New values:', { 
    supervisorPayout: correctedSupPayout, 
    officePayout: correctedOfficePayout,
    supervisorCapRemainingAfter: correctedCapAfter 
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
