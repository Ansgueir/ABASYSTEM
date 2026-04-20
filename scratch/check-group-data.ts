import { prisma } from "../src/lib/prisma";

async function main() {
    const studentId = '9bfcddd9-bd04-4231-ae3e-b1d9f7939c34';
    const att = await prisma.groupSupervisionAttendance.findMany({
        where: { studentId },
        include: { session: true }
    });
    console.log('Attendance:', JSON.stringify(att, null, 2));
}

main();
