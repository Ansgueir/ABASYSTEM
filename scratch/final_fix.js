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
    let debugCount = 0;

    for (const student of students) {
        let updates = {};
        const cleanStudentName = clean(student.fullName);
        
        if (debugCount < 5) {
            console.log(`DEBUG Student: "${student.fullName}" (Clean: "${cleanStudentName}")`);
        }

        // 1. REPARAR PLAN
        const currentPlanVal = student.planTemplateId || student.assignedOptionPlan;
        if (currentPlanVal) {
            // Si ya es un ID válido (UUID), no lo "limpiamos" para la búsqueda
            const isUUID = currentPlanVal.includes("-");
            const planId = isUUID ? currentPlanVal : planMap.get(clean(currentPlanVal));
            const plan = plans.find(p => p.id === planId);
            
            if (plan) {
                // Sincronizar solo si los valores están vacíos o el ID cambió
                if (student.planTemplateId !== plan.id || student.hoursToDo === 0) {
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
        }

        // 2. REPARAR SUPERVISOR (Fuzzy Matching)
        let expectedSupCleanName = excelMap.get(cleanStudentName);
        
        if (debugCount < 5 && !expectedSupCleanName) {
            console.log(`  - No exact student match in Excel for "${cleanStudentName}". Trying fuzzy...`);
        }

        // Si no hay match exacto, buscar el estudiante más parecido en el mapa de Excel
        if (!expectedSupCleanName) {
            for (const [exStud, exSup] of excelMap.entries()) {
                if (cleanStudentName.includes(exStud) || exStud.includes(cleanStudentName)) {
                    expectedSupCleanName = exSup;
                    if (debugCount < 5) console.log(`  - Found fuzzy student match: "${exStud}" -> Supervisor: "${exSup}"`);
                    break;
                }
            }
        }

        if (expectedSupCleanName) {
            let supId = supMap.get(expectedSupCleanName);
            
            if (debugCount < 5 && !supId) {
                console.log(`  - No exact supervisor match for "${expectedSupCleanName}". Trying fuzzy...`);
            }

            // Si el supervisor tampoco coincide exacto, buscarlo parecido
            if (!supId) {
                for (const [sName, sId] of supMap.entries()) {
                    if (expectedSupCleanName.includes(sName) || sName.includes(expectedSupCleanName)) {
                        supId = sId;
                        if (debugCount < 5) console.log(`  - Found fuzzy supervisor match: "${sName}"`);
                        break;
                    }
                }
            }

            if (supId) {
                updates.supervisorId = supId;
                
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
        debugCount++;
    }

    console.log(`Planes sincronizados: ${countPlans}`);
    console.log(`Supervisores vinculados: ${countSups}`);
    console.log("--- REPARACIÓN FINALIZADA CON ÉXITO ---");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
