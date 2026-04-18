const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
    // Find Tamara
    const student = await p.student.findFirst({
        where: { fullName: { contains: 'Tamara', mode: 'insensitive' } },
        select: { id: true, fullName: true, hourlyRate: true, planTemplateId: true }
    })

    if (!student) { console.log('Student not found'); return }
    console.log('STUDENT:', JSON.stringify(student, null, 2))

    // Check her supervision hours
    const hours = await p.supervisionHour.findMany({
        where: { studentId: student.id },
        select: { id: true, status: true, supervisionType: true, hours: true, amountBilled: true, invoiceId: true, date: true }
    })
    console.log('\nSUPERVISION HOURS:', JSON.stringify(hours, null, 2))

    // Check her invoices
    const invoices = await p.invoice.findMany({
        where: { studentId: student.id },
        select: { id: true, status: true, amountDue: true, amountPaid: true, createdAt: true }
    })
    console.log('\nINVOICES:', JSON.stringify(invoices, null, 2))
}

main()
    .catch(e => { console.error('ERROR:', e); process.exit(1) })
    .finally(() => p.$disconnect())
