const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando purga de datos...");
  
  // 1. Borrar usuarios con rol STUDENT o SUPERVISOR
  // El borrado en cascada en el esquema de Prisma se encargará de Student, Supervisor, 
  // Contract, Invoice, Document, etc. vinculados a estos usuarios.
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        in: ["STUDENT", "SUPERVISOR"]
      }
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
