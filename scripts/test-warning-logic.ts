import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testWarningLogic() {
    // Find QA student
    const student = await prisma.student.findFirst({
        where: { fullName: { contains: 'Maria' } }
    })

    if (!student) {
        console.log("Student not found")
        return
    }

    console.log(`Student: ${student.fullName}, Level: ${student.level}`)

    // Get current month hours
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [independent, supervision] = await Promise.all([
        prisma.independentHour.findMany({
            where: { studentId: student.id, date: { gte: monthStart } }
        }),
        prisma.supervisionHour.findMany({
            where: { studentId: student.id, date: { gte: monthStart } }
        })
    ])

    let totalRestricted = 0
    let totalTotal = 0

    independent.forEach(h => {
        const hours = Number(h.hours)
        totalTotal += hours
        if (h.activityType === 'RESTRICTED') {
            totalRestricted += hours
        }
    })

    supervision.forEach(h => {
        const hours = Number(h.hours)
        totalTotal += hours
        if (h.activityType === 'RESTRICTED') {
            totalRestricted += hours
        }
    })

    const percentage = (totalRestricted / totalTotal) * 100

    console.log(`\nCurrent Month Stats:`)
    console.log(`Total Hours: ${totalTotal}`)
    console.log(`Restricted Hours: ${totalRestricted}`)
    console.log(`Percentage: ${percentage.toFixed(2)}%`)
    console.log(`\nLevel: ${student.level}`)
    console.log(`Limit: ${student.level === 'BCBA' ? '40%' : '60%'}`)
    console.log(`Should trigger warning: ${student.level === 'BCaBA' && percentage > 60 ? 'YES' : 'NO'}`)

    await prisma.$disconnect()
}

testWarningLogic().catch(console.error)
