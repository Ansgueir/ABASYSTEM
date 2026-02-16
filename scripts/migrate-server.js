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
    datasources: { db: { url: "postgresql://aba_admin:Pr0s1s.2026@127.0.0.1:5432/aba_supervision?schema=public" } }
});

async function migrate() {
    if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
    log("=== Clean and Migrate Data ===\n");

    const tables = [
        { name: "StudentEvaluations", model: "studentEvaluation" },
        { name: "GroupSupervisionAttendance", model: "groupSupervisionAttendance" },
        { name: "GroupSupervisionSessions", model: "groupSupervisionSession" },
        { name: "RepeatingSchedules", model: "repeatingSchedule" },
        { name: "SupervisorPayments", model: "supervisorPayment" },
        { name: "StudentPayments", model: "studentPayment" },
        { name: "Invoices", model: "invoice" },
        { name: "SupervisionHours", model: "supervisionHour" },
        { name: "IndependentHours", model: "independentHour" },
        { name: "Documents", model: "document" },
        { name: "Contracts", model: "contract" },
        { name: "Students", model: "student" },
        { name: "OfficeMembers", model: "officeMember" },
        { name: "Supervisors", model: "supervisor" },
        { name: "Users", model: "user" },
        { name: "GeneralValues", model: "generalValues" }
    ];

    log("--- Step 1: Cleaning Local DB ---");
    // Delete in order (children first)
    for (const table of tables) {
        try {
            await server[table.model].deleteMany();
            log(`  Cleared ${table.name}`);
        } catch (e) {
            log(`  Failed to clear ${table.name}: ${e.message}`);
        }
    }

    log("\n--- Step 2: Migrating from Supabase ---");
    // Migrate in order (parents first)
    const migrateOrder = [...tables].reverse();
    for (const table of migrateOrder) {
        try {
            const items = await supabase[table.model].findMany();
            log(`${table.name}: ${items.length} records`);
            let success = 0;
            for (const item of items) {
                try {
                    await server[table.model].create({ data: item });
                    success++;
                } catch (e) {
                    log(`  Error in ${table.name} (ID: ${item.id}): ${e.message}`);
                }
            }
            log(`  📊 ${success} success`);
        } catch (e) {
            log(`  ❌ Failed to migrate ${table.name}: ${e.message}`);
        }
    }

    log("\n=== CLEAN MIGRATION COMPLETE ===");
    await supabase.$disconnect();
    await server.$disconnect();
}

migrate().catch(e => log(`Critical failure: ${e.stack}`));
