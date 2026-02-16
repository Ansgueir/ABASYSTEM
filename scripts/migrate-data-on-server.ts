import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const LOG_FILE = 'migration_server.log'
const log = (msg: string) => {
    fs.appendFileSync(LOG_FILE, msg + '\n')
    console.log(msg)
}

// Source: Supabase
const supabase = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=60" } }
})

// Destination: Localhost (Server DB)
const server = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision" } }
})

async function migrateTable(
    name: string,
    fetchFn: () => Promise<any[]>,
    upsertFn: (item: any) => Promise<any>
) {
    try {
        const items = await fetchFn()
        log(`${name}: ${items.length} records`)
        let success = 0
        let errors = 0
        for (const item of items) {
            try {
                await upsertFn(item)
                success++
            } catch (e: any) {
                errors++
                if (errors <= 5) log(`  Error in ${name}: ${e.message}`)
            }
        }
        log(`  📊 ${success} success, ${errors} errors`)
    } catch (e: any) {
        log(`  ❌ Critical failure on ${name}: ${e.message}`)
    }
}

async function migrate() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE)
    log("=== Migrating data: Supabase → Local PG on Server ===\n")

    await migrateTable("Users", () => supabase.user.findMany(), (u) => server.user.upsert({ where: { id: u.id }, update: u, create: u }))
    await migrateTable("Supervisors", () => supabase.supervisor.findMany(), (s) => server.supervisor.upsert({ where: { id: s.id }, update: s, create: s }))
    await migrateTable("OfficeMembers", () => supabase.officeMember.findMany(), (o) => server.officeMember.upsert({ where: { id: o.id }, update: o, create: o }))
    await migrateTable("Students", () => supabase.student.findMany(), (s) => server.student.upsert({ where: { id: s.id }, update: s, create: s }))
    await migrateTable("IndependentHours", () => supabase.independentHour.findMany(), (h) => server.independentHour.upsert({ where: { id: h.id }, update: h, create: h }))
    await migrateTable("SupervisionHours", () => supabase.supervisionHour.findMany(), (h) => server.supervisionHour.upsert({ where: { id: h.id }, update: h, create: h }))
    await migrateTable("Contracts", () => supabase.contract.findMany(), (c) => server.contract.upsert({ where: { id: c.id }, update: c, create: c }))
    await migrateTable("Documents", () => supabase.document.findMany(), (d) => server.document.upsert({ where: { id: d.id }, update: d, create: d }))
    await migrateTable("Invoices", () => supabase.invoice.findMany(), (i) => server.invoice.upsert({ where: { id: i.id }, update: i, create: i }))
    await migrateTable("StudentPayments", () => supabase.studentPayment.findMany(), (p) => server.studentPayment.upsert({ where: { id: p.id }, update: p, create: p }))
    await migrateTable("SupervisorPayments", () => supabase.supervisorPayment.findMany(), (p) => server.supervisorPayment.upsert({ where: { id: p.id }, update: p, create: p }))
    await migrateTable("GeneralValues", () => supabase.generalValues.findMany(), (g) => server.generalValues.upsert({ where: { id: g.id }, update: g, create: g }))
    await migrateTable("GroupSessions", () => supabase.groupSupervisionSession.findMany(), (g) => server.groupSupervisionSession.upsert({ where: { id: g.id }, update: g, create: g }))
    await migrateTable("StudentEvaluations", () => supabase.studentEvaluation.findMany(), (e) => server.studentEvaluation.upsert({ where: { id: e.id }, update: e, create: e }))

    log("\n=== MIGRATION COMPLETE ===")
    await supabase.$disconnect()
    await server.$disconnect()
}

migrate().catch(e => log(`Migration failed: ${e.message}`))
