$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Fixing Login Configuration ===" -ForegroundColor Cyan

# We overwrite the .env file with the correct Port 9000 URL
$BashCommand = "cat > /home/administrador/aba-supervision-system/.env <<EOF
DATABASE_URL=""postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision?schema=public""
NEXTAUTH_SECRET=""super_secure_secret_generated_locally_for_dev_789""
NEXTAUTH_URL=""http://170.55.79.9:9000""
EMAIL_SERVER_HOST=""mail.smtp2go.com""
EMAIL_SERVER_PORT=2525
EOF

pm2 restart aba-supervision-system"

# Use ssh to execute the heredoc. 
# We don't use -t (pseudo-tty) here to avoid control character issues with heredoc, unless strictly needed for password.
# Since we are writing to user-owned file, sudo is NOT needed. Password might still be asked for SSH login if key not present.
ssh -p $RemotePort $RemoteUser@$RemoteHost $BashCommand

Write-Host "=== Configuration Updated & App Restarted ===" -ForegroundColor Green
