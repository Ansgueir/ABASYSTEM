const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('--- LATEST 5 HOURS LOGGED ---')
    const hours = await prisma.independentHour.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { student: true }
    })

    console.table(hours.map(h => ({
        id: h.id,
        hours: h.hours,
        studentName: h.student.fullName,
        date: h.date,
        notes: h.notes
    })))
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
