
import pandas as pd
import psycopg2
import os

db_url = os.getenv("DATABASE_URL", "postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision")

def get_tables():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename;")
    tables = [t[0] for t in cur.fetchall()]
    cur.close()
    conn.close()
    return tables

def get_metadata(table_name):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    query = f"""
        SELECT 
            c.column_name, 
            c.data_type, 
            c.is_nullable,
            (SELECT 'PK' FROM information_schema.key_column_usage k 
             WHERE k.table_name = c.table_name AND k.column_name = c.column_name AND k.table_schema = c.table_schema
             AND EXISTS (SELECT 1 FROM information_schema.table_constraints tc 
                         WHERE tc.constraint_name = k.constraint_name AND tc.constraint_type = 'PRIMARY KEY')) as is_pk
        FROM information_schema.columns c
        WHERE c.table_name = '{table_name}' AND c.table_schema = 'public'
        ORDER BY c.ordinal_position;
    """
    cur.execute(query)
    meta = cur.fetchall()
    cur.close()
    conn.close()
    return meta

def get_real_data(table_name, limit=5):
    conn = psycopg2.connect(db_url)
    try:
        df = pd.read_sql_query(f'SELECT * FROM "{table_name}" LIMIT {limit}', conn)
        return df
    except:
        return pd.DataFrame()
    finally:
        conn.close()

def main():
    tables = get_tables()
    output_file = "CARGA_MASIVA_MAESTRA_ABA.xlsx"
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        for table in tables:
            print(f"Processing {table}...")
            meta = get_metadata(table)
            data = get_real_data(table)
            
            # Create a guide row from metadata
            guide = []
            headers = []
            for m in meta:
                headers.append(m[0])
                desc = m[1].upper()
                if m[3] == 'PK': desc += " (ID)"
                if m[2] == 'NO': desc += " (REQ)"
                guide.append(desc)
            
            # Create a DataFrame for the sheet
            # Row 0: Headers
            # Row 1: Guide
            # Row 2+: Data
            
            df_guide = pd.DataFrame([guide], columns=headers)
            if not data.empty:
                # Align data columns with headers just in case
                data = data.reindex(columns=headers)
                df_final = pd.concat([df_guide, data], ignore_index=True)
            else:
                df_final = df_guide
                
            # Shorten table name for sheet tab (max 31 chars)
            sheet_name = table[:31]
            df_final.to_excel(writer, sheet_name=sheet_name, index=False)
            
    print(f"SUCCESS: {output_file} generated.")

if __name__ == "__main__":
    main()
