const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const p = await prisma.supervisorPayment.findMany({ include: { student: true } });
    console.log(p.map(x => ({
        supervisor: !!x.supervisorId,
        studentName: x.student.fullName,
        amountDue: x.amountDue,
        amountAlreadyPaid: x.amountAlreadyPaid,
        amountPaidThisMonth: x.amountPaidThisMonth,
        balanceDue: x.balanceDue
    })));
}
main().catch(console.error).finally(() => prisma.$disconnect());
