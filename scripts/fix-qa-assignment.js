const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanAssignments() {
    console.log('--- CLEANING QA ASSIGNMENTS (JS VERSION) ---')
    
    try {
        // 1. Get IDs by searching for the specific QA emails
        const student = await prisma.student.findFirst({ where: { email: 'qaestudiante@abasystem.com' } })
        const supervisor = await prisma.supervisor.findFirst({ where: { email: 'qasupervisor@abasystem.com' } })

        if (!student || !supervisor) {
            console.log('QA users not found or IDs could not be resolved. Nothing to clean.')
            return
        }

        console.log(`Found Student: ${student.id} | Supervisor: ${supervisor.id}`)

        // 2. Remove Legacy link
        if (student.supervisorId === supervisor.id) {
            await prisma.student.update({
                where: { id: student.id },
                data: { supervisorId: null }
            })
            console.log('✅ Legacy link (supervisorId field) removed successfully.')
        }

        // 3. Remove N:M assignment from middle table
        const deletedAssignments = await prisma.studentSupervisor.deleteMany({
            where: {
                studentId: student.id,
                supervisorId: supervisor.id
            }
        })
        
        if (deletedAssignments.count > 0) {
            console.log(`✅ ${deletedAssignments.count} N:M relationship entries (StudentSupervisor table) removed.`)
        } else {
            console.log('No N:M relationships found to delete.')
        }

        console.log('--- CLEANUP SUCCESSFUL ---')
    } catch (err) {
        console.error('CRITICAL ERROR DURING CLEANUP:', err)
    } finally {
        await prisma.$disconnect()
    }
}

cleanAssignments()
