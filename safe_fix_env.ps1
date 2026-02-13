$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Overwriting .env configuration safely ===" -ForegroundColor Cyan

# We use printf to ensure no hidden Windows characters get into the file.
# We explicitly write \n for newlines.
$SafeCommand = 'printf "DATABASE_URL=\"postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision?schema=public\"\nNEXTAUTH_SECRET=\"super_secure_secret_generated_locally_for_dev_789\"\nNEXTAUTH_URL=\"http://170.55.79.9:9000\"\nEMAIL_SERVER_HOST=\"mail.smtp2go.com\"\nEMAIL_SERVER_PORT=2525\n" > /home/administrador/aba-supervision-system/.env'

# Execute command via SSH
ssh -p $RemotePort $RemoteUser@$RemoteHost $SafeCommand

Write-Host "=== Restarting Application ==="
ssh -p $RemotePort $RemoteUser@$RemoteHost "pm2 restart aba-supervision-system"

Write-Host "=== Fix Complete ===" -ForegroundColor Green
