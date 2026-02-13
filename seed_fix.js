const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  // Use a simple password placeholder for now.
  const passwordHash = 'hashed_password_placeholder'; 

  const user = await prisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email: email,
      passwordHash: passwordHash, 
      role: 'SUPERVISOR', // Giving appropriate role
      officeMember: {
        create: {
          fullName: 'System Administrator',
          permissions: {}
        }
      }
    },
  });
  console.log('Admin user ensured:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.();
  });
