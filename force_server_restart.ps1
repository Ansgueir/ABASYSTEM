$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

Write-Host "Connecting to server to clean cache and restart..."

# Kill existing node processes (aggressive but necessary)
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "pkill -f 'next-server' || pkill -f 'next-dev' || echo 'No node process found'"

# Remove .next folder
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "rm -rf $RemoteBase/.next"

# Start dev server in background
Write-Host "Starting server..."
ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cd $RemoteBase && timeout 5s npm run dev > /dev/null 2>&1 &"

Write-Host "Server restart initiated. Please wait 10-20 seconds before refreshing."
