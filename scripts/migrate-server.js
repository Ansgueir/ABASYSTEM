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

// Destination: Localhost (Server DB)
const server = new PrismaClient({
    datasources: { db: { url: "postgresql://postgres:Pr0s1s.2026@127.0.0.1:5432/aba_supervision?schema=public" } }
});

async function migrateTable(name, modelName) {
    try {
        const items = await supabase[modelName].findMany();
        log(`${name}: ${items.length} records`);
        let success = 0;
        let errors = 0;
        for (const item of items) {
            try {
                await server[modelName].upsert({
                    where: { id: item.id },
                    update: item,
                    create: item
                });
                success++;
            } catch (e) {
                errors++;
                if (errors <= 3) log(`  Error in ${name}: ${e.message}`);
            }
        }
        log(`  📊 ${success} success, ${errors} errors`);
    } catch (e) {
        log(`  ❌ Critical failure on ${name}: ${e.message}`);
    }
}

async function migrate() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    log("=== Starting Data Migration (JS Version) ===\n");

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
    ];

    for (const table of tables) {
        await migrateTable(table.name, table.model);
    }

    log("\n=== MIGRATION COMPLETE ===");
    await supabase.$disconnect();
    await server.$disconnect();
}

migrate().catch(e => log(`Migration failed: ${e.message}`));
