const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("--- INFORME DE INTEGRIDAD DE DATOS ---");
    
    const totalStudents = await prisma.student.count();
    const totalSupervisors = await prisma.supervisor.count();
    const totalLinked = await prisma.studentSupervisor.count();
    
    console.log(`Estudiantes totales: ${totalStudents}`);
    console.log(`Supervisores totales: ${totalSupervisors}`);
    console.log(`Vinculaciones (StudentSupervisor): ${totalLinked}`);
    
    const studentsWithoutSupervisor = await prisma.student.findMany({
        where: { supervisorId: null },
        select: { fullName: true }
    });
    
    console.log(`Estudiantes sin supervisor asignado: ${studentsWithoutSupervisor.length}`);
    if (studentsWithoutSupervisor.length > 0) {
        console.log("Muestra de nombres sin supervisor:", studentsWithoutSupervisor.slice(0, 5).map(s => s.fullName));
    }

    const studentsWithPlan = await prisma.student.findMany({
        where: { NOT: { planTemplateId: null } },
        include: { plan: true }
    });
    
    console.log(`Estudiantes con Plan asignado: ${studentsWithPlan.length}`);
    if (studentsWithPlan.length > 0) {
        const sample = studentsWithPlan[0];
        console.log(`Ejemplo Plan: ${sample.plan?.name || "Sin Nombre"}`);
        console.log(`Valores en el perfil -> Horas: ${sample.hoursToDo}, Monto: ${sample.amountToPay}`);
    }

    const plans = await prisma.plan.findMany();
    console.log("\nPlanes configurados en el sistema:", plans.map(p => p.name));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
