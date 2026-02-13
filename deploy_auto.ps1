$ErrorActionPreference = "Stop"

$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

$Files = @(
    "src\components\log-hours-dialog.tsx",
    "src\actions\log-hours.ts",
    "src\components\ui\button.tsx",
    "public\rebuild-check.txt"
)

foreach ($File in $Files) {
    $LinuxSuffix = $File.Replace("\", "/")
    $RemotePath = "$RemoteBase/$LinuxSuffix"
    Write-Host "Uploading $File to $RemotePath..."
    scp -P $Port -o BatchMode=yes -o StrictHostKeyChecking=no $File "$User@${HostName}:$RemotePath"
}

Write-Host "Restarting dev server..."
# Using a background pattern for nohup to ensure it keeps running? 
# Or just relying on the user's existing session management (pm2? screen?).
# The user said "npm error... /home/administrador/package.json", implying they run it interactively.
# I will just kill node and restart it? Or just touch a file to trigger rebuild?
# Touching a file (which we did with uploads) should trigger HMR (Hot Module Replacement) if the server is running.
# But the user showed an error log, implying the server MIGHT be crashed or stopped.
# I will attempt to start it if it's not running, or rely on them. 
# actually, the user showed "npm error code ENOENT" meaning they FAILED to start it.
# So I need to start it correctly.

ssh -p $Port -o BatchMode=yes -o StrictHostKeyChecking=no $User@$HostName "cd $RemoteBase && (npm run dev > /dev/null 2>&1 &)"
Write-Host "Deployment complete."
