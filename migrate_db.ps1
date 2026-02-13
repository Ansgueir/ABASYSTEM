$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"
$RemotePath = "/home/administrador/aba-supervision-system"
$DBPassword = "Pr0s1s.2026"

Write-Host "=== Starting Database Migration to Local Server ===" -ForegroundColor Cyan

# 1. Update Connection String for Local DB
# We assume the local DB user is 'postgres' and password is the same as server or standard.
# Based on user input, we'll try 'Pr0s1s.2026'.
# Connection string format: postgresql://USER:PASSWORD@localhost:5432/dbname
$LocalDbUrl = "postgresql://postgres:${DBPassword}@localhost:5432/aba_supervision?schema=public"

Write-Host "Updating server environment to use Local Database..."
# Create a temporary .env file content
$EnvContent = @"
DATABASE_URL="$LocalDbUrl"
NEXTAUTH_SECRET="super_secure_secret_generated_locally_for_dev_789"
NEXTAUTH_URL="http://${RemoteHost}"
EMAIL_SERVER_HOST="mail.smtp2go.com"
EMAIL_SERVER_PORT=2525
"@

# Upload new .env
$Command = "echo '$EnvContent' > $RemotePath/.env"
ssh -p $RemotePort $RemoteUser@$RemoteHost $Command

# 2. Ensure Database Exists (Idempotent)
Write-Host "Ensuring database exists..."
# We use sudo -u postgres psql to create the DB if it doesn't exist
$CreateDbCommand = "sudo -u postgres psql -tc ""SELECT 1 FROM pg_database WHERE datname = 'aba_supervision'"" | grep -q 1 || sudo -u postgres psql -c ""CREATE DATABASE aba_supervision;"""
# Also set password for postgres user if needed (optional, assuming it matches)
ssh -t -p $RemotePort $RemoteUser@$RemoteHost $CreateDbCommand

# 3. Running Migrations
Write-Host "Pushing Prisma Schema to Local DB..."
ssh -p $RemotePort $RemoteUser@$RemoteHost "cd $RemotePath && npx prisma db push --accept-data-loss"

# 4. Restart App
Write-Host "Restarting Application..."
ssh -p $RemotePort $RemoteUser@$RemoteHost "pm2 restart aba-supervision-system"

Write-Host "=== Migration Complete. App is now using Local Server DB. ===" -ForegroundColor Green
