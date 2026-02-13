#!/bin/bash
set -e

# Credentials
SUPABASE_DB="postgresql://postgres.svvxhmhkghauhnvqcgbi:Pr0s1s.2026@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30"
LOCAL_DB="postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision"

echo "=== Starting Data Migration ==="
echo "Source: Supabase"
echo "Dest:   Localhost (aba_supervision)"

# Install postgresql-client if missing (pg_dump might be missing if only server is installed, though unlikely)
# echo "Checking for pg_dump..."
# which pg_dump || sudo apt-get install -y postgresql-client

echo "Dumping from Supabase and Restoring to Local..."

# --no-owner --no-acl: Skip ownership/privilege commands (often cause issues across environments)
# --clean --if-exists: Drop objects before creating them (ensures clean state)
pg_dump "$SUPABASE_DB" --no-owner --no-acl --clean --if-exists --verbose | psql "$LOCAL_DB"

echo "=== Migration Successfully Completed ==="
