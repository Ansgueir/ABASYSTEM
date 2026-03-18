const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        const studentEmail = 'qaestudiante@abasystem.com'
        const student = await prisma.student.findFirst({ where: { email: studentEmail } })
        if (!student) return console.log('Student not found')

        console.log(`--- DUMPING LOGS FOR STUDENT ${student.id} ---`)
        
        const independent = await prisma.independentHour.findMany({
            where: { studentId: student.id },
            orderBy: { startTime: 'desc' }
        })
        console.log(`Independent Hours: ${independent.length}`)
        independent.forEach(h => {
             const start = new Date(h.startTime)
             const hours = Number(h.hours)
             const end = new Date(start.getTime() + hours * 3600000)
             console.log(`- ID: ${h.id.substring(0,8)}, Date: ${h.date.toISOString()}, Start: ${start.toISOString()}, End: ${end.toISOString()}, Notes: ${h.notes}`)
        })

        const supervision = await prisma.supervisionHour.findMany({
            where: { studentId: student.id },
            orderBy: { startTime: 'desc' }
        })
        console.log(`Supervision Hours: ${supervision.length}`)
        supervision.forEach(h => {
             const start = new Date(h.startTime)
             const hours = Number(h.hours)
             const end = new Date(start.getTime() + hours * 3600000)
             console.log(`- ID: ${h.id.substring(0,8)}, Start: ${start.toISOString()}, End: ${end.toISOString()}, Notes: ${h.notes}`)
        })

    } catch (e) { console.error(e) } 
    finally { await prisma.$disconnect() }
}
main()
