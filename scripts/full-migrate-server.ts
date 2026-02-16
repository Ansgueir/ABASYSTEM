import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const LOG_FILE = 'full_migration.log'
const log = (msg: string) => {
    fs.appendFileSync(LOG_FILE, msg + '\n')
    console.log(msg)
}

const LOCAL_DB_URL = "postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision?schema=public"
const SUPABASE_DB_URL = "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=60"

async function main() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE)
    log("=== Final Full Migration (Schema + Data) ===")

    // 1. Prisma DB Push
    log("\n--- Step 1: Pushing Schema to Local DB ---")
    try {
        // Set env var and run prisma
        process.env.DATABASE_URL = LOCAL_DB_URL
        const output = execSync('npx prisma db push --accept-data-loss', { encoding: 'utf-8' })
        log(output)
    } catch (e: any) {
        log(`Prisma Push Failed: ${e.message}`)
        log(e.stdout)
        log(e.stderr)
        // return; // Continue anyway?
    }

    // 2. Data Migration
    log("\n--- Step 2: Migrating Data ---")
    const supabase = new PrismaClient({ datasources: { db: { url: SUPABASE_DB_URL } } })
    const server = new PrismaClient({ datasources: { db: { url: LOCAL_DB_URL } } })

    const tables = [
        { name: "Users", model: "user" },
        { name: "Supervisors", model: "supervisor" },
        { name: "OfficeMembers", model: "officeMember" },
        { name: "Students", model: "student" },
        { name: "IndependentHours", model: "independentHour" },
        { name: "SupervisionHours", model: "supervisionHour" },
        { name: "Contracts", model: "contract" },
        { name: "Documents", model: "document" },
        { name: "Invoices", model: "invoice" },
        { name: "StudentPayments", model: "studentPayment" },
        { name: "SupervisorPayments", model: "supervisorPayment" },
        { name: "GeneralValues", model: "generalValues" },
        { name: "GroupSessions", model: "groupSupervisionSession" },
        { name: "StudentEvaluations", model: "studentEvaluation" }
    ]

    for (const table of tables) {
        try {
            const items = await (supabase as any)[table.model].findMany()
            log(`${table.name}: ${items.length} records`)
            let success = 0
            for (const item of items) {
                try {
                    await (server as any)[table.model].upsert({
                        where: { id: item.id },
                        update: item,
                        create: item
                    })
                    success++
                } catch (e: any) {
                    // console.error(e)
                }
            }
            log(`  📊 ${success} success`)
        } catch (e: any) {
            log(`  ❌ Error in ${table.name}: ${e.message}`)
        }
    }

    log("\n=== FULL MIGRATION COMPLETE ===")
    await supabase.$disconnect()
    await server.$disconnect()
}

main().catch(e => log(`Critical Error: ${e.message}`))
