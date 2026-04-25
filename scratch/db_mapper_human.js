
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. Get DATABASE_URL
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const dbUrlMatch = envContent.match(/DATABASE_URL="(.+?)"/);
        if (dbUrlMatch) dbUrl = dbUrlMatch[1];
    }
}

if (!dbUrl) {
    console.error("DATABASE_URL not found");
    process.exit(1);
}

const outputDir = path.join(process.cwd(), 'PLANTILLAS_MIGRACION_ABA');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

function runPsql(query) {
    try {
        const escapedQuery = query.replace(/"/g, '\\"');
        const cmd = `psql "${dbUrl}" -t -A -F "," -c "${escapedQuery}"`;
        return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (err) {
        return "";
    }
}

function getTables() {
    const query = "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;";
    return runPsql(query).split('\n').filter(t => t.trim() !== '');
}

function getTableMetadata(tableName) {
    const query = `
        SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            (SELECT 'PK' FROM information_schema.key_column_usage k 
             WHERE k.table_name = c.table_name AND k.column_name = c.column_name AND k.table_schema = c.table_schema
             AND EXISTS (SELECT 1 FROM information_schema.table_constraints tc 
                         WHERE tc.constraint_name = k.constraint_name AND tc.constraint_type = 'PRIMARY KEY')) as is_pk
        FROM information_schema.columns c
        WHERE c.table_name = '${tableName}' AND c.table_schema = 'public'
        ORDER BY c.ordinal_position;
    `;
    return runPsql(query).split('\n').map(line => {
        const parts = line.split(',');
        return { name: parts[0], type: parts[1], nullable: parts[2], pk: parts[3] === 'PK' };
    });
}

function getRealData(tableName, limit = 5) {
    const query = `SELECT * FROM "${tableName}" LIMIT ${limit};`;
    return runPsql(query);
}

async function main() {
    const tables = getTables();
    console.log(`Generating ${tables.length} clean templates...`);
    
    for (const table of tables) {
        console.log(`  Creating ${table}.csv...`);
        const meta = getTableMetadata(table);
        
        let fileContent = "";
        
        // Row 1: Human Headers
        fileContent += meta.map(m => m.name).join(',') + '\n';
        
        // Row 2: Technical Guide
        fileContent += meta.map(m => {
            let guide = m.type.toUpperCase();
            if (m.pk) guide += " (ID)";
            if (m.nullable === 'NO') guide += " (OBLIGATORIO)";
            return `"${guide}"`;
        }).join(',') + '\n';
        
        // Rows 3+: Real Data
        const realData = getRealData(table);
        if (realData) {
            fileContent += realData + '\n';
        }
        
        fs.writeFileSync(path.join(outputDir, `${table}.csv`), fileContent);
    }
    
    console.log(`\nSUCCESS: Templates created in ${outputDir}`);
}

main();
