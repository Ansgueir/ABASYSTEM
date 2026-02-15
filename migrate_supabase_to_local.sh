#!/bin/bash
set -e

echo "=== Migrando datos de Supabase a PostgreSQL local ==="

SUPABASE_URL="postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require"
LOCAL_URL="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"

# Step 1: Dump data from Supabase (data only, no schema since we used prisma db push)
echo "Exportando datos de Supabase..."
PGPASSWORD="Pr0s1s.2026" pg_dump \
    -h aws-0-us-west-2.pooler.supabase.com \
    -p 5432 \
    -U "postgres.svvxhmhkghauhnvqcgbi" \
    -d postgres \
    --schema=public \
    --data-only \
    --no-owner \
    --no-acl \
    --inserts \
    --disable-triggers \
    -f /tmp/supabase_data.sql

echo "Datos exportados a /tmp/supabase_data.sql"
echo "Tamaño del archivo:"
ls -lh /tmp/supabase_data.sql

# Step 2: Import into local PostgreSQL
echo "Importando datos a PostgreSQL local..."
PGPASSWORD="Pr0s1s.2026" psql \
    -h localhost \
    -U aba_admin \
    -d aba_supervision \
    -f /tmp/supabase_data.sql

echo "=== Migración completada ==="

# Step 3: Verify
echo "Verificando tablas:"
PGPASSWORD="Pr0s1s.2026" psql -h localhost -U aba_admin -d aba_supervision -c "
SELECT 'Users' AS tabla, count(*) FROM \"User\"
UNION ALL SELECT 'Students', count(*) FROM \"Student\"
UNION ALL SELECT 'Supervisors', count(*) FROM \"Supervisor\"
UNION ALL SELECT 'IndependentHours', count(*) FROM \"IndependentHour\"
UNION ALL SELECT 'SupervisionHours', count(*) FROM \"SupervisionHour\"
UNION ALL SELECT 'Invoices', count(*) FROM \"Invoice\"
;"
