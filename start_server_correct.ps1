$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

Write-Host "Stopping all Next.js servers..."
# Kill both potential instances
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "pkill -f 'next-server' || pkill -f 'next-dev' || echo 'Clean slate'"

Write-Host "Starting server on DEFAULT PORT 3000 (Internal)..."
# Run with nohup on default port
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cd $RemoteBase && nohup npm run dev > server.log 2>&1 &"

Write-Host "Server started. Checking logs..."
Start-Sleep -Seconds 5
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "tail -n 10 $RemoteBase/server.log"
