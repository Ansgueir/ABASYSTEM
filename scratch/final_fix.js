const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const prisma = new PrismaClient();

async function main() {
    console.log("--- INICIANDO REPARACIÓN INTEGRAL PROFUNDA (PLANES + SUPERVISORES) ---");

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
        
        // 1. REPARAR PLAN Y CAMPOS FINANCIEROS/HORAS (Para que se vean en UI)
        const currentPlanVal = student.planTemplateId || student.assignedOptionPlan;
        if (currentPlanVal) {
            const isUUID = currentPlanVal.includes("-");
            const planId = isUUID ? currentPlanVal : planMap.get(clean(currentPlanVal));
            const plan = plans.find(p => p.id === planId);
            
            if (plan) {
                updates.planTemplateId = plan.id;
                updates.assignedOptionPlan = plan.name;
                
                // Campos que la UI lee (hoursTargetReg, independentHoursTarget, etc.)
                const totalH = plan.totalHours || 0;
                const supH = parseFloat(plan.amountSupHours?.toString() || "0");
                const indivH = Math.round(totalH - supH);

                updates.hoursTargetReg = totalH;
                updates.independentHoursTarget = indivH;
                updates.totalAmountContract = plan.totalCost;
                
                // Comisiones
                const supCommission = parseFloat(plan.supervisorCommission?.toString() || "0");
                updates.analystPaymentRate = supCommission;
                updates.officePaymentRate = 1 - supCommission;

                // Otros campos de horas
                updates.hoursToDo = totalH;
                updates.hoursPerMonth = plan.hoursPerMonth || 130;
                updates.totalMonths = plan.numberOfMonths || plan.totalMonths || 12;
                updates.amountToPay = plan.monthlyPayment || plan.totalCost || 0;
                updates.supervisionPercentage = plan.supervisedPercentage || 0.05;
                updates.hourlyRate = plan.hourlyRate || 0;
                updates.fieldworkType = plan.fieldworkType || "REGULAR";

                countPlans++;
            }
        }

        // 2. REPARAR SUPERVISOR (Fuzzy Matching)
        let expectedSupCleanName = excelMap.get(cleanStudentName);
        if (!expectedSupCleanName) {
            for (const [exStud, exSup] of excelMap.entries()) {
                if (cleanStudentName.includes(exStud) || exStud.includes(cleanStudentName)) {
                    expectedSupCleanName = exSup;
                    break;
                }
            }
        }

        if (expectedSupCleanName) {
            let supId = supMap.get(expectedSupCleanName);
            if (!supId) {
                for (const [sName, sId] of supMap.entries()) {
                    if (expectedSupCleanName.includes(sName) || sName.includes(expectedSupCleanName)) {
                        supId = sId;
                        break;
                    }
                }
            }

            if (supId) {
                updates.supervisorId = supId;
                await prisma.studentSupervisor.upsert({
                    where: { studentId_supervisorId: { studentId: student.id, supervisorId: supId } },
                    update: { isPrimary: true },
                    create: { studentId: student.id, supervisorId: supId, isPrimary: true }
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

    console.log(`Planes sincronizados profundamente: ${countPlans}`);
    console.log(`Supervisores vinculados: ${countSups}`);
    console.log("--- REPARACIÓN FINALIZADA ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
