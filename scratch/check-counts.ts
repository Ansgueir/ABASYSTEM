import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30"
        }
    }
})

async function main() {
    const count = await prisma.supervisionHour.count({
        where: { supervisionType: 'GROUP' }
    })
    console.log(`Total SupervisionHour (GROUP): ${count}`)

    const samples = await prisma.supervisionHour.findMany({
        where: { supervisionType: 'GROUP' },
        take: 10,
        select: { id: true, date: true, startTime: true, studentId: true }
    })
    console.log("Samples:", samples)
    
    const attCount = await prisma.groupSupervisionAttendance.count()
    console.log(`Total Group Attendance: ${attCount}`)

    const attSamples = await prisma.groupSupervisionAttendance.findMany({
        take: 10,
        include: { session: true }
    })
    console.log("Att Samples:", attSamples)
}

main()
