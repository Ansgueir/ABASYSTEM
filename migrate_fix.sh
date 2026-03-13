#!/bin/bash
SUPABASE_DB="postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
LOCAL_DB="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"
echo "=== Dumping from Supabase (port 6543) and Restoring to Local ==="
pg_dump "$SUPABASE_DB" --no-owner --no-acl --clean --if-exists | PGPASSWORD='Pr0s1s.2026' psql -h localhost -U aba_admin -d aba_supervision
echo "=== Done ==="
