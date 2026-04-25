const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando purga de datos...");
  
  // 1. Borrar dependencias primero
  await prisma.independentHour.deleteMany({});
  await prisma.groupSupervisionAttendance.deleteMany({});
  await prisma.contractGroupAssignment.deleteMany({});
  await prisma.groupStudent.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.document.deleteMany({
    where: {
      user: {
        role: { in: ["STUDENT", "SUPERVISOR"] }
      }
    }
  });
  await prisma.studentSupervisor.deleteMany({});
  
  // 2. Borrar perfiles
  await prisma.student.deleteMany({});
  await prisma.supervisor.deleteMany({});
  
  // 3. Borrar usuarios
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: { in: ["STUDENT", "SUPERVISOR"] }
    }
  });
  
  console.log(`Usuarios eliminados (Estudiantes/Supervisores): ${deletedUsers.count}`);
  
  // 2. Borrar todos los lotes de importación previos
  const deletedBatches = await prisma.importBatch.deleteMany({});
  console.log(`Lotes de importación eliminados: ${deletedBatches.count}`);
  
  console.log("PURGA COMPLETADA. La base de datos está limpia de Estudiantes y Supervisores.");
}

main()
  .catch((e) => {
    console.error("Error durante la purga:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
