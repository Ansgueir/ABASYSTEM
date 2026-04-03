import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('REVERTING INVOICES TO READY_TO_GO...')
    await prisma.invoice.updateMany({
        data: {
            status: 'READY_TO_GO',
            amountPaid: 0
        }
    })
    
    console.log('CLEARING TRANSACTIONS (CLEAN AUDIT START)...')
    // Correct way to clear tables without dropping schema
    await (prisma as any).supervisorLedgerEntry.deleteMany()
    await (prisma as any).studentPayment.deleteMany()
    await (prisma as any).supervisorPayout.deleteMany()
    
    console.log('CLEANUP COMPLETED ✓')
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(async () => { await prisma.$disconnect() })
