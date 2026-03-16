const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Password123!', 10);
  const users = [
    { email: 'qaestudiante@abasystem.com', role: 'STUDENT' },
    { email: 'qaoffice@abasystem.com', role: 'ADMIN' },
    { email: 'qasupervisor@abasystem.com', role: 'SUPERVISOR' }
  ];

  console.log('Iniciando creación de usuarios...');

  for (const u of users) {
    try {
      // Borrar si ya existe para asegurar limpieza
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        console.log(`Usuario ${u.email} ya existe. Recreando...`);
        await prisma.user.delete({ where: { email: u.email } });
      }

      await prisma.user.create({
        data: {
          email: u.email,
          passwordHash: hash,
          role: u.role,
          isActive: true,
          isFirstLogin: false,
          onboardingCompleted: true
        }
      });
      console.log(`✅ Creado: ${u.email}`);
    } catch (e) {
      console.error(`❌ Error con ${u.email}:`, e.message);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
