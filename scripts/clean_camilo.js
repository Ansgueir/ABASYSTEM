
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const student = await prisma.student.findFirst({
        where: { fullName: { contains: 'Camilo' } }
    })
    
    if (!student) {
        console.log('Student not found')
        return
    }
    
    console.log(`Cleaning up student: ${student.fullName} (${student.id})`)
    
    // Delete all PENDING group hours to let the contract re-generator do its job
    const deleted = await prisma.supervisionHour.deleteMany({
        where: {
            studentId: student.id,
            supervisionType: 'GROUP',
            status: 'PENDING'
        }
    })
    
    console.log(`Deleted ${deleted.count} pending group session hours.`)
    await prisma.$disconnect()
}

main()
