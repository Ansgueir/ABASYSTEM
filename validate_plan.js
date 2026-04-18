const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Find invoice E8D0B9 (last 6 chars match)
    const invoices = await p.invoice.findMany({
        where: { student: { email: 'tamaroshki@gmail.com' } },
        include: {
            supervisionHours: {
                select: {
                    id: true, date: true, activityType: true, supervisionType: true,
                    hours: true, amountBilled: true, status: true, supervisorPay: true
                }
            },
            payouts: true
        },
        orderBy: { invoiceDate: 'desc' }
    })

    for (const inv of invoices) {
        const sumBilled = inv.supervisionHours.reduce((s, h) => s + Number(h.amountBilled || 0), 0)
        const shortId = inv.id.slice(-6).toUpperCase()
        console.log(`\n═══ Invoice #${shortId} ═══`)
        console.log(`  Status        : ${inv.status}`)
        console.log(`  invoiceDate   : ${inv.invoiceDate.toISOString().split('T')[0]}`)
        console.log(`  amountDue(DB) : $${Number(inv.amountDue).toFixed(2)}`)
        console.log(`  amountPaid(DB): $${Number(inv.amountPaid).toFixed(2)}`)
        console.log(`  Linked Hours  : ${inv.supervisionHours.length} entries`)
        console.log(`  sumAmtBilled  : $${sumBilled.toFixed(2)}`)
        if (Math.abs(sumBilled - Number(inv.amountDue)) > 0.01) {
            console.log(`  ⚠️  MISMATCH: amountDue($${Number(inv.amountDue).toFixed(2)}) ≠ sumBilled($${sumBilled.toFixed(2)}) — diff: $${(Number(inv.amountDue) - sumBilled).toFixed(2)}`)
        }
        if (inv.supervisionHours.length > 0) {
            console.log(`  Hours detail:`)
            inv.supervisionHours.forEach(h => {
                console.log(`    - ${h.date.toISOString().split('T')[0]} | ${h.activityType}/${h.supervisionType} | ${h.hours}h | $${Number(h.amountBilled||0).toFixed(2)} | supervisorPay:$${Number(h.supervisorPay||0).toFixed(2)} | status:${h.status}`)
            })
        }
        if (inv.payouts && inv.payouts.length > 0) {
            console.log(`  Payouts(${inv.payouts.length}):`)
            inv.payouts.forEach((po) => {
                console.log(`    - $${Number(po.amount||0).toFixed(2)} | ${po.method} | ${po.paidAt?.toISOString().split('T')[0] ?? 'no date'}`)
            })
        }
    }

    // Also check if there are supervision hours for this student NOT linked to any invoice
    const unlinked = await p.supervisionHour.findMany({
        where: {
            student: { email: 'tamaroshki@gmail.com' },
            invoiceId: null
        },
        select: { id: true, date: true, activityType: true, hours: true, amountBilled: true, status: true }
    })
    console.log(`\n═══ UNLINKED SupervisionHours (invoiceId = null): ${unlinked.length} ═══`)
    unlinked.forEach(h => {
        console.log(`  - ${h.date.toISOString().split('T')[0]} | ${h.activityType} | ${h.hours}h | $${Number(h.amountBilled||0).toFixed(2)} | ${h.status}`)
    })
}

main().finally(() => p.$disconnect())
