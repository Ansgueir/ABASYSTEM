const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanAssignments() {
    console.log('--- CLEANING QA ASSIGNMENTS ---')
    
    // 1. Get IDs
    const student = await prisma.student.findFirst({ where: { email: 'qaestudiante@abasystem.com' } })
    const supervisor = await prisma.supervisor.findFirst({ where: { email: 'qasupervisor@abasystem.com' } })

    if (!student || !supervisor) {
        console.log('QA users not found. Nothing to clean.')
        return
    }

    // 2. Remove Legacy link
    if (student.supervisorId === supervisor.id) {
        await prisma.student.update({
            where: { id: student.id },
            data: { supervisorId: null }
        })
        console.log('✅ Legacy link removed.')
    }

    // 3. Remove N:M assignment
    const deletedAssignments = await prisma.studentSupervisor.deleteMany({
        where: {
            studentId: student.id,
            supervisorId: supervisor.id
        }
    })
    
    if (deletedAssignments.count > 0) {
        console.log(`✅ ${deletedAssignments.count} N:M assignments removed.`)
    }

    console.log('--- CLEANUP COMPLETE ---')
}

cleanAssignments()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
