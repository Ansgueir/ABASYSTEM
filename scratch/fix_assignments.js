const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    console.log("--- INICIANDO REPARACIÓN DE ASIGNACIONES Y PLANES ---");

    // 1. Obtener todos los estudiantes y supervisores para mapeo
    const students = await prisma.student.findMany();
    const supervisors = await prisma.supervisor.findMany();
    const plans = await prisma.plan.findMany();

    console.log(`Procesando ${students.length} estudiantes...`);

    for (const student of students) {
        let updates = {};
        
        // 2. REPARAR PLAN (Buscar por ID o por Nombre)
        if (student.planTemplateId) {
            // Intentar buscar por ID primero, luego por Nombre
            let plan = plans.find(p => p.id === student.planTemplateId || p.name === student.planTemplateId);
            
            // Si el nombre del plan está en assignedOptionPlan, intentar por ahí también
            if (!plan && student.assignedOptionPlan) {
                plan = plans.find(p => p.name === student.assignedOptionPlan);
            }

            if (plan) {
                console.log(`- Sincronizando plan '${plan.name}' para ${student.fullName}`);
                updates.planTemplateId = plan.id;
                updates.assignedOptionPlan = plan.name;
                updates.hoursToDo = plan.totalHours || student.hoursToDo;
                updates.hoursPerMonth = plan.hoursPerMonth || student.hoursPerMonth;
                updates.totalMonths = plan.numberOfMonths || plan.totalMonths || student.totalMonths;
                updates.amountToPay = plan.monthlyPayment || plan.totalCost || student.amountToPay;
                updates.supervisionPercentage = plan.supervisedPercentage || student.supervisionPercentage;
                updates.hourlyRate = plan.hourlyRate || student.hourlyRate;
            }
        }

        // 3. REPARAR VINCULACIÓN DE SUPERVISOR (Si supervisorId es null pero tenemos historial)
        // Nota: Asumimos que si no tiene supervisor primario, intentaremos buscar uno basado en el lote o nombres comunes.
        // Pero lo más efectivo es asegurar que si existe en StudentSupervisor, sea el primario.
        const assignment = await prisma.studentSupervisor.findFirst({
            where: { studentId: student.id, isPrimary: true }
        });
        
        if (assignment && !student.supervisorId) {
            console.log(`- Asignando supervisor primario a ${student.fullName}`);
            updates.supervisorId = assignment.supervisorId;
        }

        if (Object.keys(updates).length > 0) {
            await prisma.student.update({
                where: { id: student.id },
                data: updates
            });
        }
    }

    console.log("--- REPARACIÓN FINALIZADA ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
