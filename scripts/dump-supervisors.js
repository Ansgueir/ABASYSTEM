
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const supervisors = await prisma.supervisor.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, fullName: true, bacbId: true, credentialType: true }
    });

    console.log(JSON.stringify(supervisors, (key, value) => {
      if (typeof value === 'bigint') return value.toString();
      return value;
    }, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
