import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("Starting Group Session Synchronization...")
    
    // 1. Get all group attendance records that are marked as "attended"
    const attendances = await prisma.groupSupervisionAttendance.findMany({
        where: { attended: true },
        include: {
            session: {
                include: {
                    supervisor: true,
                    group: true
                }
            },
            student: true
        }
    })

    console.log(`Found ${attendances.length} attendance records.`)

    let created = 0
    let skipped = 0

    for (const attendance of attendances) {
        if (!attendance.session) continue

        // Check if a SupervisionHour already exists for this attendance
        // We match by student, date, and startTime
        const existing = await prisma.supervisionHour.findFirst({
            where: {
                studentId: attendance.studentId,
                date: attendance.session.date,
                startTime: attendance.session.startTime,
                supervisionType: 'GROUP'
            }
        })

        if (!existing) {
            // Create the missing record
            await prisma.supervisionHour.create({
                data: {
                    studentId: attendance.studentId,
                    supervisorId: attendance.session.supervisorId,
                    date: attendance.session.date,
                    startTime: attendance.session.startTime,
                    hours: 1, // Default duration if not specified
                    supervisionType: 'GROUP',
                    setting: 'OFFICE_CLINIC',
                    activityType: 'RESTRICTED',
                    notes: `Migrated Group Session: ${attendance.session.topic || attendance.session.group?.name || 'Group Session'}`,
                    groupTopic: attendance.session.topic,
                    status: 'PENDING'
                }
            })
            created++
        } else {
            skipped++
        }
    }

    console.log(`Migration completed. Created: ${created}, Already existed: ${skipped}`)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
