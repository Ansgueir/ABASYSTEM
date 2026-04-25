const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando purga total de datos de Estudiantes y Supervisores...");

  // Tablas de dependencias directas e indirectas (orden de prioridad para evitar FK errors)
  const dependencyModels = [
    'supervisorPayout',
    'paymentRecord',
    'supervisorPayment',
    'studentPayment',
    'supervisorLedgerEntry',
    'independentHour',
    'supervisionHour',
    'groupSupervisionAttendance',
    'groupSupervisionSession',
    'studentEvaluation',
    'contractSupervisor',
    'contractGroupAssignment',
    'groupStudent',
    'supervisorGroup',
    'contract',
    'invoice',
    'financialPeriod',
    'studentSupervisor',
    'student',
    'supervisor'
  ];

  for (const model of dependencyModels) {
    if (prisma[model]) {
      try {
        const result = await prisma[model].deleteMany({});
        console.log(`- Tabla ${model}: eliminados ${result.count} registros.`);
      } catch (e) {
        console.warn(`- Tabla ${model}: saltada o error (posiblemente vacía o restricción).`);
      }
    }
  }

  // Especial: Auditoría y Logs
  try {
    await prisma.auditLog.deleteMany({
      where: {
        user: {
          role: { in: ["STUDENT", "SUPERVISOR"] }
        }
      }
    });
    await prisma.importLog.deleteMany({});
    console.log("- Logs de auditoría e importación eliminados.");
  } catch (e) {
    console.warn("- Error al borrar logs, saltando...");
  }

  // Especial: Documentos (solo de estudiantes y supervisores)
  try {
    const deletedDocs = await prisma.document.deleteMany({
      where: {
        user: {
          role: { in: ["STUDENT", "SUPERVISOR"] }
        }
      }
    });
    console.log(`- Documentos eliminados: ${deletedDocs.count}`);
  } catch (e) {
    console.warn("- Error al borrar documentos, saltando...");
  }

  // Final: Usuarios
  try {
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        role: { in: ["STUDENT", "SUPERVISOR"] }
      }
    });
    console.log(`- Usuarios eliminados (STUDENT/SUPERVISOR): ${deletedUsers.count}`);
  } catch (e) {
    console.error("- ERROR CRÍTICO al borrar usuarios:", e.message);
  }

  // Limpiar batches
  await prisma.importBatch.deleteMany({});
  
  console.log("\nPURGA FINALIZADA. La base de datos está limpia de datos inyectados.");
}

main()
  .catch((e) => {
    console.error("Error fatal en el script:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
