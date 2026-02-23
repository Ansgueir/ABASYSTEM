const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const payments = await prisma.supervisorPayment.findMany();
    for (const p of payments) {
        let update = false;
        let newAmtDue = Number(p.amountDue);
        let newBalance = Number(p.balanceDue);

        if (newBalance < 0) {
            newBalance = 0;
            update = true;
        }

        const calculatedDue = Number(p.amountAlreadyPaid) + newBalance;
        if (newAmtDue < calculatedDue) {
            newAmtDue = calculatedDue;
            update = true;
        }

        if (update) {
            await prisma.supervisorPayment.update({
                where: { id: p.id },
                data: {
                    balanceDue: newBalance,
                    amountDue: newAmtDue
                }
            });
            console.log(`Updated payment ${p.id} to amountDue=${newAmtDue} and balanceDue=${newBalance}`);
        }
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
