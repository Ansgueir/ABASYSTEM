$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Updating PostgreSQL Client on Server ===" -ForegroundColor Cyan
Write-Host "This script will log in via SSH and run the update commands." -ForegroundColor Yellow

# We construct the exact bash command sequence to fix the repo and install the client
# We use the 'postgresql-common' method which is the most robust
$BashCommand = "sudo apt-get update && sudo apt-get install -y postgresql-common && sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y && sudo apt-get update && sudo apt-get install -y postgresql-client-17 && pg_dump --version"

# Execute via SSH with pseudo-terminal (-t) to allow password prompts
# The user will type the password when prompted.
ssh -t -p $RemotePort $RemoteUser@$RemoteHost $BashCommand

Write-Host "=== Update Script Finished ===" -ForegroundColor Green
