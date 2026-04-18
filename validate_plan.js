// Clean all activity records, preserve: User, Student, Supervisor, OfficeMember,
// Plan, Contract, Document, GeneralValues, FinancialPeriod, SupervisorGroup, GroupStudent
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
    console.log('Starting clean...')

    // Order: children before parents to avoid FK violations

    // 1. Attendance records (depend on GroupSupervisionSession)
    const a1 = await p.groupSupervisionAttendance.deleteMany({})
    console.log('GroupSupervisionAttendance deleted:', a1.count)

    // 2. Group sessions
    const a2 = await p.groupSupervisionSession.deleteMany({})
    console.log('GroupSupervisionSession deleted:', a2.count)

    // 3. Supervisor ledger entries (depend on Invoice)
    const a3 = await p.supervisorLedgerEntry.deleteMany({})
    console.log('SupervisorLedgerEntry deleted:', a3.count)

    // 4. Supervisor payouts (depend on Invoice)
    const a4 = await p.supervisorPayout.deleteMany({})
    console.log('SupervisorPayout deleted:', a4.count)

    // 5. Supervision hours (depend on Invoice)
    const a5 = await p.supervisionHour.deleteMany({})
    console.log('SupervisionHour deleted:', a5.count)

    // 6. Independent hours
    const a6 = await p.independentHour.deleteMany({})
    console.log('IndependentHour deleted:', a6.count)

    // 7. Invoices (must be after hours and payouts)
    const a7 = await p.invoice.deleteMany({})
    console.log('Invoice deleted:', a7.count)

    // 8. Student payments
    const a8 = await p.studentPayment.deleteMany({})
    console.log('StudentPayment deleted:', a8.count)

    // 9. Supervisor payments (legacy cards)
    const a9 = await p.supervisorPayment.deleteMany({})
    console.log('SupervisorPayment deleted:', a9.count)

    // 10. Student evaluations (activity records)
    const a10 = await p.studentEvaluation.deleteMany({})
    console.log('StudentEvaluation deleted:', a10.count)

    // 11. Repeating schedules
    const a11 = await p.repeatingSchedule.deleteMany({})
    console.log('RepeatingSchedule deleted:', a11.count)

    // 12. Import logs and batches
    const a12 = await p.importLog.deleteMany({})
    console.log('ImportLog deleted:', a12.count)
    const a13 = await p.importBatch.deleteMany({})
    console.log('ImportBatch deleted:', a13.count)

    // 13. Audit logs
    const a14 = await p.auditLog.deleteMany({})
    console.log('AuditLog deleted:', a14.count)

    // 14. Notifications
    const a15 = await p.notification.deleteMany({})
    console.log('Notification deleted:', a15.count)

    console.log('\nDone. Users, Students, Supervisors, Plans, Contracts, Documents are intact.')
}

main()
    .catch(e => { console.error('ERROR:', e); process.exit(1) })
    .finally(() => p.$disconnect())
