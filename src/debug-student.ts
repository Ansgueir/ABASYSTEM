import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const student = await prisma.student.findFirst({
        where: { email: 'andyfilth@gmail.com' },
        include: { supervisor: true }
    })
    console.log('STUDENT:', JSON.stringify(student, null, 2))
}

main()
