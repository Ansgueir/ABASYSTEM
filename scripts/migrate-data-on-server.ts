import { PrismaClient } from '@prisma/client'

// Source: Supabase
const supabase = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30"
        }
    }
})

// Destination: Localhost (Server DB)
const server = new PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision"
        }
    }
})

async function migrateTable<T extends Record<string, any>>(
    name: string,
    fetchFn: () => Promise<T[]>,
    upsertFn: (item: T) => Promise<any>
) {
    try {
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
            }
        }
        console.log(`  ✅ ${success} migrated, ${errors} errors`)
    } catch (e: any) {
        console.error(`  ❌ Failed to migrate ${name}: ${e.message}`)
    }
}

async function migrate() {
    console.log("=== Migrating data: Supabase → Local PG on Server ===\n")

    await migrateTable("Users", () => supabase.user.findMany(), (u) => server.user.upsert({ where: { id: u.id }, update: u, create: u }))
    await migrateTable("Supervisors", () => supabase.supervisor.findMany(), (s) => server.supervisor.upsert({ where: { id: s.id }, update: s, create: s }))
    await migrateTable("OfficeMember", () => supabase.officeMember.findMany(), (o) => server.officeMember.upsert({ where: { id: o.id }, update: o, create: o }))
    await migrateTable("Students", () => supabase.student.findMany(), (s) => server.student.upsert({ where: { id: s.id }, update: s, create: s }))
    await migrateTable("IndependentHours", () => supabase.independentHour.findMany(), (h) => server.independentHour.upsert({ where: { id: h.id }, update: h, create: h }))
    await migrateTable("SupervisionHours", () => supabase.supervisionHour.findMany(), (h) => server.supervisionHour.upsert({ where: { id: h.id }, update: h, create: h }))
    await migrateTable("Contracts", () => supabase.contract.findMany(), (c) => server.contract.upsert({ where: { id: c.id }, update: c, create: c }))
    await migrateTable("Documents", () => supabase.document.findMany(), (d) => server.document.upsert({ where: { id: d.id }, update: d, create: d }))
    await migrateTable("Invoices", () => supabase.invoice.findMany(), (i) => server.invoice.findMany(), (i) => server.invoice.upsert({ where: { id: i.id }, update: i, create: i }))
    await migrateTable("StudentPayments", () => supabase.studentPayment.findMany(), (p) => server.studentPayment.upsert({ where: { id: p.id }, update: p, create: p }))
    await migrateTable("SupervisorPayments", () => supabase.supervisorPayment.findMany(), (p) => server.supervisorPayment.upsert({ where: { id: p.id }, update: p, create: p }))
    await migrateTable("GeneralValues", () => supabase.generalValues.findMany(), (g) => server.generalValues.upsert({ where: { id: g.id }, update: g, create: g }))
    await migrateTable("GroupSessions", () => supabase.groupSupervisionSession.findMany(), (g) => server.groupSupervisionSession.upsert({ where: { id: g.id }, update: g, create: g }))
    await migrateTable("StudentEvaluations", () => supabase.studentEvaluation.findMany(), (e) => server.studentEvaluation.upsert({ where: { id: e.id }, update: e, create: e }))

    console.log("\n=== MIGRATION COMPLETE ===")
    await supabase.$disconnect()
    await server.$disconnect()
}

migrate().catch(console.error)
