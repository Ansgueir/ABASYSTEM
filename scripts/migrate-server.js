const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const LOG_FILE = 'migration_server.log';
const log = (msg) => {
    fs.appendFileSync(LOG_FILE, msg + '\n');
    console.log(msg);
};

// Source: Supabase
const supabase = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=60" } }
});

// Destination: Localhost (Server DB) - Using aba_admin
const server = new PrismaClient({
    datasources: { db: { url: "postgresql://aba_admin:Pr0s1s.2026@127.0.0.1:5432/aba_supervision?schema=public" } }
});

async function migrateTable(name, modelName) {
    try {
        const items = await supabase[modelName].findMany();
        log(`${name}: ${items.length} records`);
        let success = 0;
        let errors = 0;
        for (const item of items) {
            try {
                // Remove some potential conflicting data if necessary or just upsert
                await server[modelName].upsert({
                    where: { id: item.id },
                    update: item,
                    create: item
                });
                success++;
            } catch (e) {
                errors++;
                if (errors <= 5) log(`  Error in ${name} (ID: ${item.id}): ${e.message}`);
            }
        }
        log(`  📊 ${success} success, ${errors} errors`);
    } catch (e) {
        log(`  ❌ Critical failure on ${name}: ${e.message}`);
    }
}

async function migrate() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    log("=== Final Data Migration (JS + aba_admin) ===\n");

    // Order matters for FK constraints: 
    // 1. Independent entities 
    // 2. Supervisors/Students 
    // 3. Child entities (Hours, Invoices, etc.)
    const tables = [
        { name: "Users", model: "user" },
        { name: "Supervisors", model: "supervisor" },
        { name: "OfficeMembers", model: "officeMember" },
        { name: "Students", model: "student" },
        { name: "GeneralValues", model: "generalValues" },
        { name: "Contracts", model: "contract" },
        { name: "Documents", model: "document" },
        { name: "IndependentHours", model: "independentHour" },
        { name: "SupervisionHours", model: "supervisionHour" },
        { name: "Invoices", model: "invoice" },
        { name: "StudentPayments", model: "studentPayment" },
        { name: "SupervisorPayments", model: "supervisorPayment" },
        { name: "RepeatingSchedules", model: "repeatingSchedule" },
        { name: "GroupSupervisionSessions", model: "groupSupervisionSession" },
        { name: "StudentEvaluations", model: "studentEvaluation" }
    ];

    for (const table of tables) {
        await migrateTable(table.name, table.model);
    }

    log("\n=== MIGRATION COMPLETE ===");
    await supabase.$disconnect();
    await server.$disconnect();
}

migrate().catch(e => log(`Migration failed: ${e.stack}`));
