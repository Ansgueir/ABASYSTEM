const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
    const c = await prisma.supervisorLedgerEntry.count();
    console.log('Total Ledger Entries:', c);
    const sp = await prisma.supervisorPayment.count();
    console.log('Total Legacy Sup Payments:', sp);
}
check().finally(() => prisma.$disconnect());
