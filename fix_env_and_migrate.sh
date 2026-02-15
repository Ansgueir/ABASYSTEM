#!/bin/bash
cd /home/administrador/aba-supervision-system

# Restore backup first
cp .env.backup .env

# Now write a clean .env with local database
cat > .env << 'ENVFILE'
# Production Database - Local PostgreSQL on disk 2
DATABASE_URL="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"

# NextAuth Configuration
NEXTAUTH_SECRET="super_secure_secret_generated_locally_for_dev_789"
NEXTAUTH_URL="http://170.55.79.9:9000"
AUTH_TRUST_HOST=true

# SMTP Configuration (SMTP2GO)
EMAIL_SERVER_HOST="mail.smtp2go.com"
EMAIL_SERVER_PORT=2525
EMAIL_SERVER_USER="placeholder_user"
EMAIL_SERVER_PASSWORD="placeholder_password"
EMAIL_FROM="no-reply@abasupervision.com"
ENVFILE

echo "=== New .env ==="
cat .env

echo ""
echo "=== Running Prisma db push ==="
npx prisma db push --accept-data-loss

echo ""
echo "=== Running Prisma generate ==="
npx prisma generate

echo "=== DONE ==="
