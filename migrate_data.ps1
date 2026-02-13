$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"
$RemotePath = "/home/administrador"
$ScriptFile = "migrate_supabase.sh"

Write-Host "=== Migrating DATA from Supabase to Local Server ===" -ForegroundColor Cyan
Write-Host "1. Uploading migration script..."
scp -P $RemotePort $ScriptFile $RemoteUser@${RemoteHost}:${RemotePath}/

Write-Host "2. Executing migration on server..."
# We make it executable and run it. 
# It contains the credentials, so it runs non-interactively on the server side (except for sudo/psql password if needed)
ssh -t -p $RemotePort $RemoteUser@$RemoteHost "chmod +x $RemotePath/$ScriptFile && $RemotePath/$ScriptFile"

Write-Host "=== Data Migration Script Finished ===" -ForegroundColor Green
