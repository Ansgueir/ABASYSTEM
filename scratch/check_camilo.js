const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const student = await prisma.student.findFirst({
        where: { fullName: { contains: 'Camilo' } }
    });
    
    if (!student) {
        console.log("No student found");
        return;
    }
    
    console.log("Student ID:", student.id);
    
    const invoices = await prisma.invoice.findMany({
        where: { studentId: student.id },
        include: {
            supervisionHours: true
        }
    });
    
    console.log("Invoices count:", invoices.length);
    invoices.forEach(inv => {
        console.log(`\nInvoice ID: ${inv.id}`);
        console.log(`Amount Due: ${inv.amountDue}`);
        console.log(`Hours attached: ${inv.supervisionHours.length}`);
        inv.supervisionHours.forEach(h => {
             console.log(`  - Hour: ${h.hours}, Type: ${h.supervisionType}, Amt: ${h.amountBilled}`);
        });
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
