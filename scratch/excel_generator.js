
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || "postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision";

function runPsql(query) {
    try {
        const escapedQuery = query.replace(/"/g, '\\"');
        const cmd = `psql "${dbUrl}" -t -A -F "|" -c "${escapedQuery}"`;
        const result = execSync(cmd, { encoding: 'utf8' }).trim();
        return result ? result.split('\n').map(line => line.split('|')) : [];
    } catch (err) {
        return [];
    }
}

function getTables() {
    return runPsql("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;").map(t => t[0]);
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
    return runPsql(query);
}

function getRealData(tableName, limit = 5) {
    return runPsql(`SELECT * FROM "${tableName}" LIMIT ${limit};`);
}

async function main() {
    const tables = getTables();
    console.log(`Generating Master Excel (XML format) with ${tables.length} sheets...`);
    
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#4F81BD" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="guide">
   <Font ss:Italic="1" ss:Color="#555555"/>
   <Interior ss:Color="#DCE6F1" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

    for (const table of tables) {
        console.log(`  Adding sheet: ${table}...`);
        const meta = getTableMetadata(table);
        const data = getRealData(table);
        
        xml += `\n <Worksheet ss:Name="${table.substring(0, 31)}">\n  <Table>`;
        
        // Headers row
        xml += `\n   <Row ss:StyleID="header">`;
        meta.forEach(m => {
            xml += `\n    <Cell><Data ss:Type="String">${m[0]}</Data></Cell>`;
        });
        xml += `\n   </Row>`;
        
        // Guide row
        xml += `\n   <Row ss:StyleID="guide">`;
        meta.forEach(m => {
            let guide = m[1].toUpperCase();
            if (m[3] === 'PK') guide += " (ID)";
            if (m[2] === 'NO') guide += " (REQ)";
            xml += `\n    <Cell><Data ss:Type="String">${guide}</Data></Cell>`;
        });
        xml += `\n   </Row>`;
        
        // Data rows
        data.forEach(row => {
            xml += `\n   <Row>`;
            row.forEach(val => {
                const escaped = String(val || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                xml += `\n    <Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
            });
            xml += `\n   </Row>`;
        });
        
        xml += `\n  </Table>\n </Worksheet>`;
    }
    
    xml += `\n</Workbook>`;
    
    fs.writeFileSync('CARGA_MASIVA_MAESTRA_ABA.xls', xml);
    console.log(`\nSUCCESS: CARGA_MASIVA_MAESTRA_ABA.xls generated.`);
}

main();
