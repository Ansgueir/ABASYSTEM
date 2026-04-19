import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
    console.log("Starting missing group hours generation...");
    
    // Get all attendances
    const attendances = await prisma.groupSupervisionAttendance.findMany({
        where: { attended: true },
        include: { session: true }
    });

    console.log(`Found ${attendances.length} total group attendances.`);

    let created = 0;
    
    for (const att of attendances) {
        // Check if a SupervisionHour already exists for this student on this date/time from this group
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
                    hours: 1, // Assume 1 hour for old group sessions without duration
                    supervisionType: 'GROUP',
                    setting: 'OFFICE_CLINIC',
                    activityType: 'RESTRICTED',
                    notes: `Group Session: ${att.session.topic}`,
                    groupTopic: att.session.topic,
                    status: 'PENDING',
                    groupSessionId: att.sessionId // Link specifically to GroupSession
                }
            });
            created++;
            console.log(`Created missing hour for student ${att.studentId} on ${att.session.date.toISOString()}`);
        }
    }

    console.log(`Migration complete. Created ${created} missing supervision hours.`);
}

run()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
