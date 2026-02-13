$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

Write-Host "Starting server on PORT 9000..."

# Use nohup to keep it alive, redirect output to a log file so we can debug if it fails again
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cd $RemoteBase && nohup npm run dev -- -p 9000 > server.log 2>&1 &"

Write-Host "Server started in background. Waiting 5 seconds to verify..."
Start-Sleep -Seconds 5

# Check if it's running
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cat $RemoteBase/server.log | head -n 20"
