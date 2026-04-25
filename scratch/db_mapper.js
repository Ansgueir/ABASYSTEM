
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

function runPsql(query) {
    try {
        // Use double quotes for the query to handle shell escaping better
        // And use single quotes inside for psql command if needed, but here we wrap the whole thing
        const escapedQuery = query.replace(/"/g, '\\"');
        const cmd = `psql "${dbUrl}" -t -A -F "," -c "${escapedQuery}"`;
        return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (err) {
        // Silence errors here to continue with next tables
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
            (SELECT 'YES' FROM information_schema.key_column_usage k 
             WHERE k.table_name = c.table_name AND k.column_name = c.column_name AND k.table_schema = c.table_schema
             AND EXISTS (SELECT 1 FROM information_schema.table_constraints tc 
                         WHERE tc.constraint_name = k.constraint_name AND tc.constraint_type = 'PRIMARY KEY')) as is_pk,
            (SELECT 'YES' FROM information_schema.key_column_usage k 
             WHERE k.table_name = c.table_name AND k.column_name = c.column_name AND k.table_schema = c.table_schema
             AND EXISTS (SELECT 1 FROM information_schema.table_constraints tc 
                         WHERE tc.constraint_name = k.constraint_name AND tc.constraint_type = 'FOREIGN KEY')) as is_fk
        FROM information_schema.columns c
        WHERE c.table_name = '${tableName}' AND c.table_schema = 'public'
        ORDER BY c.ordinal_position;
    `;
    return runPsql(query).split('\n').map(line => {
        const parts = line.split(',');
        return { name: parts[0], type: parts[1], nullable: parts[2], pk: parts[3] === 'YES', fk: parts[4] === 'YES' };
    });
}

function getRealData(tableName, limit = 3) {
    const query = `SELECT * FROM "${tableName}" LIMIT ${limit};`;
    return runPsql(query);
}

async function main() {
    const tables = getTables();
    console.log(`Processing ${tables.length} tables with REAL DATA (Fixed Quoting)...`);
    
    let csvContent = "";
    
    for (const table of tables) {
        console.log(`  Mapping ${table}...`);
        const meta = getTableMetadata(table);
        
        csvContent += `------------------------------------------------------------\n`;
        csvContent += `TABLE: ${table}\n`;
        csvContent += `------------------------------------------------------------\n`;
        
        // Fila 1: Headers
        csvContent += meta.map(m => m.name).join(',') + '\n';
        
        // Fila 2: Metadata
        csvContent += meta.map(m => {
            let desc = m.type.toUpperCase();
            if (m.pk) desc += ' (PK)';
            if (m.fk) desc += ' (FK)';
            if (m.nullable === 'NO') desc += ' NOT NULL';
            return `"${desc}"`;
        }).join(',') + '\n';
        
        // Fila 3 en adelante: Real Data
        const realData = getRealData(table);
        if (realData) {
            csvContent += realData + '\n';
        } else {
            csvContent += "(No data found or empty table)\n";
        }
        
        csvContent += '\n\n'; // Separator
    }
    
    const outputPath = path.join(process.cwd(), 'mappeo_db_importacion.csv');
    fs.writeFileSync(outputPath, csvContent);
    console.log(`\nSUCCESS: Mapping with REAL DATA saved to ${outputPath}`);
}

main();
