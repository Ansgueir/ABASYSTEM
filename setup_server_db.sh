#!/bin/bash
set -e

echo "=== Configurando PostgreSQL ==="

# Crear usuario y base de datos
sudo -u postgres psql <<EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aba_admin') THEN
        CREATE ROLE aba_admin WITH LOGIN PASSWORD 'Pr0s1s.2026';
    END IF;
END
\$\$;

SELECT 'User check done';

-- Create database if not exists
SELECT datname FROM pg_database WHERE datname = 'aba_supervision';
EOF

sudo -u postgres psql -c "CREATE DATABASE aba_supervision OWNER aba_admin;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE aba_supervision TO aba_admin;"
sudo -u postgres psql -d aba_supervision -c "GRANT ALL ON SCHEMA public TO aba_admin;"

# Verify connection
PGPASSWORD='Pr0s1s.2026' psql -h localhost -U aba_admin -d aba_supervision -c "SELECT 'Connection OK' AS status;"

echo "=== PostgreSQL listo ==="
echo "DATABASE_URL=postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"
