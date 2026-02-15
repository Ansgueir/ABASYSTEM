import { PrismaClient } from '@prisma/client'

// Source: Supabase
const supabase = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30"
        }
    }
})

// Destination: Server DB via SSH tunnel (localhost:5433 -> server:5432)
const server = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://aba_admin:Pr0s1s.2026@localhost:5433/aba_supervision"
        }
    }
})

async function migrateTable<T extends Record<string, any>>(
    name: string,
    fetchFn: () => Promise<T[]>,
    upsertFn: (item: T) => Promise<any>
) {
    const items = await fetchFn()
    console.log(`${name}: ${items.length} records`)
    let success = 0
    let errors = 0
    for (const item of items) {
        try {
            await upsertFn(item)
            success++
        } catch (e: any) {
            errors++
            console.error(`  Error on ${name}: ${e.message?.substring(0, 100)}`)
        }
    }
    console.log(`  ✅ ${success} migrated, ${errors} errors`)
}

async function migrate() {
    console.log("=== Migrating data: Supabase → Server (via SSH tunnel) ===\n")

    // 1. Users (must be first - other tables reference users)
    await migrateTable("Users",
        () => supabase.user.findMany(),
        (u) => server.user.upsert({ where: { id: u.id }, update: u, create: u })
    )

    // 2. Supervisors
    await migrateTable("Supervisors",
        () => supabase.supervisor.findMany(),
        (s) => server.supervisor.upsert({ where: { id: s.id }, update: s, create: s })
    )

    // 3. Office Members
    await migrateTable("OfficeMember",
        () => supabase.officeMember.findMany(),
        (o) => server.officeMember.upsert({ where: { id: o.id }, update: o, create: o })
    )

    // 4. Students
    await migrateTable("Students",
        () => supabase.student.findMany(),
        (s) => server.student.upsert({ where: { id: s.id }, update: s, create: s })
    )

    // 5. Independent Hours
    await migrateTable("IndependentHours",
        () => supabase.independentHour.findMany(),
        (h) => server.independentHour.upsert({ where: { id: h.id }, update: h, create: h })
    )

    // 6. Supervision Hours
    await migrateTable("SupervisionHours",
        () => supabase.supervisionHour.findMany(),
        (h) => server.supervisionHour.upsert({ where: { id: h.id }, update: h, create: h })
    )

    // 7. Contracts
    await migrateTable("Contracts",
        () => supabase.contract.findMany(),
        (c) => server.contract.upsert({ where: { id: c.id }, update: c, create: c })
    )

    // 8. Documents
    await migrateTable("Documents",
        () => supabase.document.findMany(),
        (d) => server.document.upsert({ where: { id: d.id }, update: d, create: d })
    )

    // 9. Invoices
    await migrateTable("Invoices",
        () => supabase.invoice.findMany(),
        (i) => server.invoice.upsert({ where: { id: i.id }, update: i, create: i })
    )

    // 10. Student Payments
    await migrateTable("StudentPayments",
        () => supabase.studentPayment.findMany(),
        (p) => server.studentPayment.upsert({ where: { id: p.id }, update: p, create: p })
    )

    // 11. Supervisor Payments
    await migrateTable("SupervisorPayments",
        () => supabase.supervisorPayment.findMany(),
        (p) => server.supervisorPayment.upsert({ where: { id: p.id }, update: p, create: p })
    )

    // 12. General Values
    await migrateTable("GeneralValues",
        () => supabase.generalValues.findMany(),
        (g) => server.generalValues.upsert({ where: { id: g.id }, update: g, create: g })
    )

    // 13. Group Sessions
    await migrateTable("GroupSessions",
        () => supabase.groupSupervisionSession.findMany(),
        (g) => server.groupSupervisionSession.upsert({ where: { id: g.id }, update: g, create: g })
    )

    // 14. Student Evaluations
    await migrateTable("StudentEvaluations",
        () => supabase.studentEvaluation.findMany(),
        (e) => server.studentEvaluation.upsert({ where: { id: e.id }, update: e, create: e })
    )

    console.log("\n=== MIGRATION COMPLETE ===")

    await supabase.$disconnect()
    await server.$disconnect()
}

migrate().catch(e => {
    console.error("Migration failed:", e)
    process.exit(1)
})
