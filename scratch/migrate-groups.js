const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    console.log('Starting Group Sync JS...');
    try {
        const attendances = await prisma.groupSupervisionAttendance.findMany({
            where: { attended: true },
            include: { session: true }
        });
        console.log('Found ' + attendances.length + ' attendances.');
        let created = 0;
        let skipped = 0;
        for (const att of attendances) {
            if (!att.session) continue;
            const existing = await prisma.supervisionHour.findFirst({
                where: {
                    studentId: att.studentId,
                    date: att.session.date,
                    startTime: att.session.startTime,
                    supervisionType: 'GROUP'
                }
            });
            if (!existing) {
                await prisma.supervisionHour.create({
                    data: {
                        studentId: att.studentId,
                        supervisorId: att.session.supervisorId,
                        date: att.session.date,
                        startTime: att.session.startTime,
                        hours: 1,
                        supervisionType: 'GROUP',
                        setting: 'OFFICE_CLINIC',
                        activityType: 'RESTRICTED',
                        notes: 'Auto-sync: ' + (att.session.topic || 'Group Session'),
                        groupTopic: att.session.topic,
                        status: 'PENDING'
                    }
                });
                created++;
            } else {
                skipped++;
            }
        }
        console.log('Sync done. Created: ' + created + ', Skipped: ' + skipped);
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
