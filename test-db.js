const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
    console.log('Testing database connection...')
    try {
        const studentCount = await prisma.student.count()
        console.log(`Successfully connected! Found ${studentCount} students.`)

        const supervisorCount = await prisma.supervisor.count()
        console.log(`Found ${supervisorCount} supervisors.`)

    } catch (e) {
        console.error('Data connection FAILED:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
