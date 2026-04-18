const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Find Tamara
    const student = await p.student.findFirst({
        where: { email: 'tamaroshki@gmail.com' },
        include: { invoices: true }
    })

    if (!student) { console.log('Student not found'); return }

    console.log('=== STUDENT ===')
    console.log('Name:', student.fullName)
    console.log('planTemplateId:', student.planTemplateId)

    const totalBilled = student.invoices.reduce((s, i) => s + Number(i.amountDue), 0)
    const totalPaid   = student.invoices.reduce((s, i) => s + Number(i.amountPaid), 0)

    console.log('\n=== INVOICES ===')
    student.invoices.forEach(i => {
        console.log(`  #${i.id.slice(-6)} | ${i.status} | Due: $${Number(i.amountDue).toFixed(2)} | Paid: $${Number(i.amountPaid).toFixed(2)}`)
    })
    console.log(`\nTotal Billed: $${totalBilled.toFixed(2)}`)
    console.log(`Total Paid:   $${totalPaid.toFixed(2)}`)
    console.log(`Pending now:  $${(totalBilled - totalPaid).toFixed(2)}`)

    if (student.planTemplateId) {
        const plan = await p.plan.findUnique({ where: { id: student.planTemplateId } })
        console.log('\n=== PLAN ===')
        console.log('Name:', plan.name)
        console.log('totalHours:', plan.totalHours)
        console.log('hoursPerMonth:', plan.hoursPerMonth)
        console.log('supervisedPercentage:', plan.supervisedPercentage ? Number(plan.supervisedPercentage) : null)
        console.log('hourlyRate:', plan.hourlyRate ? Number(plan.hourlyRate) : null)
        console.log('amountSupHours:', plan.amountSupHours ? Number(plan.amountSupHours) : null)
        console.log('totalCost (contract):', plan.totalCost ? Number(plan.totalCost) : null)
        console.log('monthlyPayment:', plan.monthlyPayment ? Number(plan.monthlyPayment) : null)
        console.log('numberOfMonths:', plan.numberOfMonths)
        console.log('\n=== VALIDATION ===')
        const totalCost = Number(plan.totalCost || 0)
        console.log(`contractTotal - totalPaid = $${(totalCost - totalPaid).toFixed(2)}  (Contract Remaining = everything left to complete contract)`)
        console.log(`contractTotal - totalBilled = $${(totalCost - totalBilled).toFixed(2)} (Future unbilled months)`)
        console.log(`monthlyPayment * numberOfMonths = $${(Number(plan.monthlyPayment||0) * (plan.numberOfMonths||0)).toFixed(2)} (Expected totalCost check)`)
    }
}

main().finally(() => p.$disconnect())
