// Repair: create invoice for Tamara's orphaned APPROVED hour
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
    const student = await p.student.findFirst({
        where: { fullName: { contains: 'Tamara', mode: 'insensitive' } },
        select: { id: true, fullName: true, hourlyRate: true, planTemplateId: true }
    })
    if (!student) { console.log('Student not found'); return }

    // Get plan hourlyRate as fallback
    let hourlyRate = Number(student.hourlyRate || 0)
    if (student.planTemplateId) {
        const plan = await (p).plan.findUnique({
            where: { id: student.planTemplateId },
            select: { hourlyRate: true }
        })
        if (plan?.hourlyRate) hourlyRate = Number(plan.hourlyRate)
    }
    console.log('hourlyRate resolved:', hourlyRate)

    // Find orphaned APPROVED hours (no invoiceId)
    const orphanedHours = await p.supervisionHour.findMany({
        where: {
            studentId: student.id,
            status: 'APPROVED',
            invoiceId: null
        }
    })
    console.log('Orphaned hours:', orphanedHours.length)
    if (orphanedHours.length === 0) { console.log('Nothing to repair'); return }

    const totalAmountDue = orphanedHours.reduce((sum, h) => sum + Number(h.hours) * hourlyRate, 0)
    console.log('Total amountDue to invoice:', totalAmountDue)

    await p.$transaction(async (tx) => {
        // Create or find READY_TO_GO invoice
        let invoice = await tx.invoice.findFirst({
            where: { studentId: student.id, status: 'READY_TO_GO' }
        })
        if (!invoice) {
            invoice = await tx.invoice.create({
                data: {
                    studentId: student.id,
                    invoiceDate: new Date(),
                    amountDue: 0,
                    amountPaid: 0,
                    status: 'READY_TO_GO'
                }
            })
            console.log('Invoice created:', invoice.id)
        } else {
            console.log('Using existing invoice:', invoice.id)
        }

        for (const h of orphanedHours) {
            const amountBilled = Number(h.hours) * hourlyRate
            await tx.supervisionHour.update({
                where: { id: h.id },
                data: { amountBilled, invoiceId: invoice.id }
            })
            await tx.invoice.update({
                where: { id: invoice.id },
                data: { amountDue: { increment: amountBilled } }
            })
            console.log(`Hour ${h.id.slice(-6)} repaired: amountBilled=$${amountBilled}`)
        }
    })

    console.log('\nDone. Invoice is now ready in Payments.')
}

main()
    .catch(e => { console.error('ERROR:', e); process.exit(1) })
    .finally(() => p.$disconnect())
