const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

async function main() {
    console.log("--- INICIANDO REPARACIÓN INTEGRAL (PLANES + SUPERVISORES) ---");

    const mappingPath = path.join(__dirname, "student_supervisor_map.json");
    if (!fs.existsSync(mappingPath)) {
        console.error("ERROR: No se encontró el archivo de mapeo student_supervisor_map.json");
        return;
    }
    const rawMapping = JSON.parse(fs.readFileSync(mappingPath, "utf8"));
    console.log(`Mapeo cargado: ${rawMapping.length} registros.`);

    const students = await prisma.student.findMany();
    const supervisors = await prisma.supervisor.findMany();
    const plans = await prisma.plan.findMany();

    // Helpers de limpieza
    const clean = (str) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "") : "";

    const supMap = new Map();
    supervisors.forEach(s => supMap.set(clean(s.fullName), s.id));

    const planMap = new Map();
    plans.forEach(p => planMap.set(clean(p.name), p.id));
    plans.forEach(p => planMap.set(p.id, p.id));

    const excelMap = new Map();
    rawMapping.forEach(m => excelMap.set(clean(m.s), clean(m.sup)));

    let countPlans = 0;
    let countSups = 0;

    for (const student of students) {
        let updates = {};
        const cleanStudentName = clean(student.fullName);
        
        // 1. REPARAR PLAN
        const currentPlanVal = student.planTemplateId || student.assignedOptionPlan;
        if (currentPlanVal) {
            const planId = planMap.get(clean(currentPlanVal));
            const plan = plans.find(p => p.id === planId);
            
            if (plan) {
                updates.planTemplateId = plan.id;
                updates.assignedOptionPlan = plan.name;
                updates.hoursToDo = plan.totalHours || student.hoursToDo;
                updates.hoursPerMonth = plan.hoursPerMonth || student.hoursPerMonth;
                updates.totalMonths = plan.numberOfMonths || plan.totalMonths || student.totalMonths;
                updates.amountToPay = plan.monthlyPayment || plan.totalCost || student.amountToPay;
                updates.supervisionPercentage = plan.supervisedPercentage || student.supervisionPercentage;
                updates.hourlyRate = plan.hourlyRate || student.hourlyRate;
                countPlans++;
            }
        }

        // 2. REPARAR SUPERVISOR
        const expectedSupCleanName = excelMap.get(cleanStudentName);
        if (expectedSupCleanName) {
            const supId = supMap.get(expectedSupCleanName);
            if (supId) {
                updates.supervisorId = supId;
                
                // Asegurar registro en StudentSupervisor
                await prisma.studentSupervisor.upsert({
                    where: {
                        studentId_supervisorId: {
                            studentId: student.id,
                            supervisorId: supId
                        }
                    },
                    update: { isPrimary: true },
                    create: {
                        studentId: student.id,
                        supervisorId: supId,
                        isPrimary: true
                    }
                });
                countSups++;
            }
        }

        if (Object.keys(updates).length > 0) {
            await prisma.student.update({
                where: { id: student.id },
                data: updates
            });
        }
    }

    console.log(`Planes sincronizados: ${countPlans}`);
    console.log(`Supervisores vinculados: ${countSups}`);
    console.log("--- REPARACIÓN FINALIZADA CON ÉXITO ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
