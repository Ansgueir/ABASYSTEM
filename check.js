const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    await prisma.student.updateMany({
        where: { fullName: 'QA Estudiante' },
        data: { hourlyRate: 50.00 }
    });
    console.log('Updated QA Estudiante to $50/hour rate');
}
main().catch(console.error).finally(() => prisma.$disconnect());
