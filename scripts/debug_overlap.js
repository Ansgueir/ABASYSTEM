const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        console.log('--- DEBUGGING TIME OVERLAP ---')
        const studentEmail = 'qaestudiante@abasystem.com'
        const student = await prisma.student.findFirst({ where: { email: studentEmail } })
        
        if (!student) {
            console.log('Student not found')
            return
        }

        const dateStr = '2026-03-18'
        const dateObj = new Date(dateStr)
        
        const dayStart = new Date(dateObj)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dateObj)
        dayEnd.setHours(23, 59, 59, 999)

        console.log(`Checking for student ${student.id} on date ${dateStr}`)
        console.log(`Range: ${dayStart.toISOString()} - ${dayEnd.toISOString()}`)

        const indep = await prisma.independentHour.findMany({
            where: {
                studentId: student.id,
                date: {
                    gte: dayStart,
                    lte: dayEnd
                }
            }
        })

        console.log(`Found ${indep.length} independent hours for this date range`)
        indep.forEach(h => {
            console.log(`- ID: ${h.id}, Start: ${h.startTime.toISOString()}, Hours: ${h.hours}, Date: ${h.date.toISOString()}`)
        })

        const totalIndep = await prisma.independentHour.findMany({
            where: {
                studentId: student.id
            },
            take: 20,
            orderBy: { date: 'desc' }
        })
        console.log(`Recent logs (all dates): ${totalIndep.length}`)
        totalIndep.forEach(h => {
            console.log(`- ID: ${h.id}, Start: ${h.startTime.toISOString()}, Date: ${h.date.toISOString()}`)
        })

    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
