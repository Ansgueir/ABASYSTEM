$ErrorActionPreference = "Stop"

$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$RemoteBase = "/home/administrador/aba-supervision-system"

# Files to sync
$Files = @(
    "src\components\log-hours-dialog.tsx",
    "src\actions\log-hours.ts",
    "src\components\ui\button.tsx",
    "public\rebuild-check.txt"
)

Write-Host "=== Subiendo parches a $HostName ==="
Write-Host "Te pedirá la contraseña para cada archivo (lo siento, es limitación de SCP sin claves)."
Write-Host "Contraseña: Pr0s1s.2026"
Write-Host ""

foreach ($File in $Files) {
    # Convert windows path to linux suffix
    $LinuxSuffix = $File.Replace("\", "/")
    $RemotePath = "$RemoteBase/$LinuxSuffix"
    
    Write-Host "Subiendo: $File -> $RemotePath"
    
    # Run SCP
    # Note: scp expects source then destination
    scp -P $Port $File "$User@${HostName}:$RemotePath"
}

Write-Host ""
Write-Host "=== Archivos subidos ==="
Write-Host "Ahora por favor reinicia el servidor en tu terminal SSH:"
Write-Host "1. Ve a la carpeta: cd aba-supervision-system"
Write-Host "2. Reinicia: npm run dev"
