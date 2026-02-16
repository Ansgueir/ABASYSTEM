$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

Write-Host "Stopping all Next.js servers..."
# Run pkill but ignore exit code using "|| true" equivalent in bash
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "pkill -f 'next dev' || pkill -f 'next-server' || echo 'No process found'"

Write-Host "Starting server on PORT 3000 (Internal)..."
# Truncate log file first
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "echo '' > $RemoteBase/server.log"

# Start new instance
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cd $RemoteBase && nohup npm run dev > server.log 2>&1 &"

Write-Host "Server started. Waiting 5s..."
Start-Sleep -Seconds 5
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cat $RemoteBase/server.log | head -n 20"
