$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Seeding Admin User (SQL Safe Mode) ===" -ForegroundColor Cyan

# SQL Content
$SqlContent = @"
INSERT INTO "User" ("id", "email", "passwordHash", "role", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000000', 'admin@admin.com', '$2b$10$vu8L2Y/NnhDcTYReEEAckudZvzq9bCF9f8NUTLZ6ZNrs6j2d0NntW', 'SUPERVISOR', now(), now())
ON CONFLICT ("email") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
"@

# Encode to Base64
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($SqlContent)
$Encoded = [System.Convert]::ToBase64String($Bytes)

Write-Host "Payload Size: $($Encoded.Length)"

# Execute via SSH
# Decode -> file -> psql execution
$RemoteCommand = "echo '$Encoded' | base64 -d > /tmp/seed_admin.sql && sudo -u postgres psql -d aba_supervision -f /tmp/seed_admin.sql"

ssh -t -p $RemotePort $RemoteUser@$RemoteHost $RemoteCommand

Write-Host "=== Seed Complete ===" -ForegroundColor Green
