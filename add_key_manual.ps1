
# Script para agregar llave SSH al servidor
# Este script asume que tienes acceso con contraseña y simplemente automatiza
# el comando correcto para agregar tu llave pública al authorized_keys remoto.

$User = "administrador"
$HostName = "170.55.79.9"
$Port = "22022"
$KeyPath = "$env:USERPROFILE\.ssh\id_rsa.pub"

if (-not (Test-Path $KeyPath)) {
    Write-Error "No se encontró la llave pública en $KeyPath"
    exit 1
}

$PublicKey = Get-Content $KeyPath
Write-Host "Llave pública encontrada."
Write-Host "Intentando agregar llave al servidor $HostName..."
Write-Host "CUANDO SE TE PIDA, INGRESA LA CONTRASEÑA: Pr0s1s.2026"

# Usamos ssh directamente para ejecutar el comando de append
# Nota: Detectamos si el servidor usa CMD o PowerShell por defecto intentando ambos estilos si es necesario
# Pero para Windows OpenSSH, el default suele ser CMD.
# El comando seguro es usar powershell remoto para manejar el archivo

$RemoteCommand = "powershell -Command `"New-Item -Force -ItemType Directory .ssh; Add-Content -Force .ssh\authorized_keys -Value '$PublicKey'`""

ssh -p $Port $User@$HostName $RemoteCommand

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n¡ÉXITO! La llave ha sido agregada."
    Write-Host "Prueba conectarte ahora sin contraseña:"
    Write-Host "ssh -p $Port $User@$HostName"
}
else {
    Write-Host "`nFALLÓ. Por favor verifica la contraseña y el error anterior."
}
