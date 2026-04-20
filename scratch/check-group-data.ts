import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log("--- GROUP SESSIONS ---")
    const sessions = await prisma.groupSupervisionSession.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { attendance: true }
    })
    console.log(JSON.stringify(sessions, null, 2))

    console.log("\n--- GROUP ATTENDANCE ---")
    const attendance = await prisma.groupSupervisionAttendance.findMany({
        take: 5,
        orderBy: { id: 'desc' }
    })
    console.log(JSON.stringify(attendance, null, 2))

    console.log("\n--- SUPERVISION HOURS (GROUP) ---")
    const groupHours = await prisma.supervisionHour.findMany({
        where: { supervisionType: 'GROUP' },
        take: 5,
        orderBy: { date: 'desc' },
        include: { student: { select: { fullName: true } } }
    })
    console.log(JSON.stringify(groupHours, null, 2))
}

main()
