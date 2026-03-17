
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const studentId = "f6ea6173-6161-4c9d-99e7-c627392a56c2";
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        documents: true,
        contracts: {
          include: {
            supervisors: {
              include: {
                supervisor: true
              }
            }
          }
        },
        independentHours: true,
        supervisionHours: true,
        invoices: true
      }
    });

    console.log(JSON.stringify(student, (key, value) => {
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
