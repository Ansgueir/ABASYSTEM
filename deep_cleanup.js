const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deepCleanup() {
    console.log("Starting deep cleanup...");
    
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete all transactional and relational data
            console.log("Clearing transactional data...");
            await tx.studentSupervisor.deleteMany({});
            await tx.studentPayment.deleteMany({});
            await tx.supervisorLedgerEntry.deleteMany({});
            await tx.supervisorPayment.deleteMany({});
            await tx.invoice.deleteMany({});
            await tx.independentHour.deleteMany({});
            await tx.contract.deleteMany({});
            await tx.supervisionLog.deleteMany({});
            await tx.document.deleteMany({});
            await tx.groupSupervisionStudent.deleteMany({});
            await tx.groupSupervisionSession.deleteMany({});
            await tx.groupSupervision.deleteMany({});
            await tx.importBatch.deleteMany({});
            
            // 2. Delete Student and Supervisor profiles
            console.log("Clearing Student and Supervisor profiles...");
            await tx.student.deleteMany({});
            await tx.supervisor.deleteMany({});
            
            // 3. Delete Users that are NOT Office/Admin
            console.log("Clearing Student/Supervisor users (Keeping Office/Admin safe)...");
            const rolesToDelete = ['STUDENT', 'SUPERVISOR'];
            // We specifically exclude roles that could be Office
            await tx.user.deleteMany({
                where: {
                    role: { in: rolesToDelete }
                }
            });
            
            console.log("Cleanup finished successfully.");
        }, { timeout: 60000 });
    } catch (error) {
        console.error("Error during cleanup:", error);
    }
}

deepCleanup().finally(() => prisma.$disconnect());
