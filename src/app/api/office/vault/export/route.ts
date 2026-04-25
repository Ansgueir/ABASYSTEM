import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import * as xlsx from "xlsx"

export async function GET() {
    try {
        const wb = xlsx.utils.book_new();
        
        // 1. Get all tables in public schema
        const tables: any[] = await prisma.$queryRawUnsafe(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE '\\_%'
        `);

        for (const t of tables) {
            const tableName = t.table_name;
            if (tableName === '_prisma_migrations') continue;
            
            // 2. Get column metadata
            const columns: any[] = await prisma.$queryRawUnsafe(`
                SELECT 
                    c.column_name, 
                    c.data_type, 
                    c.is_nullable,
                    (
                        SELECT CASE WHEN COUNT(*) > 0 THEN 'PK' ELSE '' END
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.table_name = c.table_name
                          AND kcu.column_name = c.column_name
                          AND tc.constraint_type = 'PRIMARY KEY'
                    ) as is_pk,
                    (
                        SELECT CASE WHEN COUNT(*) > 0 THEN 'FK' ELSE '' END
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu
                          ON tc.constraint_name = kcu.constraint_name
                        WHERE tc.table_name = c.table_name
                          AND kcu.column_name = c.column_name
                          AND tc.constraint_type = 'FOREIGN KEY'
                    ) as is_fk
                FROM information_schema.columns c
                WHERE c.table_schema = 'public' 
                  AND c.table_name = $1
                ORDER BY c.ordinal_position
            `, tableName);

            // 3. Get actual data
            const data: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);

            // 4. Build sheet rows
            const sheetRows: any[] = [];
            
            // Row 1: Headers
            const headers = columns.map(c => c.column_name);
            sheetRows.push(headers);
            
            // Row 2: Metadata
            const metaRow = columns.map(c => {
                const parts = [c.data_type.toUpperCase()];
                if (c.is_pk === 'PK') parts.push('PK');
                if (c.is_fk === 'FK') parts.push('FK');
                if (c.is_nullable === 'YES') parts.push('NULL');
                else parts.push('NOT NULL');
                return parts.join(' | ');
            });
            sheetRows.push(metaRow);

            // Row 3+: Data
            for (const row of data) {
                const dataRow = columns.map(c => {
                    let val = row[c.column_name];
                    // Format dates, objects, arrays safely for Excel
                    if (val instanceof Date) return val.toISOString();
                    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                    return val;
                });
                sheetRows.push(dataRow);
            }

            // Create sheet
            const ws = xlsx.utils.aoa_to_sheet(sheetRows);
            
            // Excel limits sheet names to 31 chars
            const safeSheetName = tableName.substring(0, 31);
            xlsx.utils.book_append_sheet(wb, ws, safeSheetName);
        }

        const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buffer, {
            headers: {
                "Content-Disposition": "attachment; filename=MAPEO_DB_COMPLETO_ABA.xlsx",
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        });
    } catch (e: any) {
        console.error("[EXPORT ERROR]", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
