const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const sp = await prisma.supervisorPayment.findMany({ include: { student: true } });
    console.log(sp);
}
main().catch(console.error).finally(() => prisma.$disconnect());
