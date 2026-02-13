
# Script para configurar llave SSH y copiarla al servidor
$User = "administrator"
$HostName = "170.55.79.9"
$Port = "22022"
$KeyPath = "$env:USERPROFILE\.ssh\id_rsa"

# 1. Generar llave si no existe
if (-not (Test-Path "$KeyPath")) {
    Write-Host "Generando nueva llave SSH..."
    ssh-keygen -t rsa -b 4096 -f "$KeyPath" -N ""
}
else {
    Write-Host "La llave SSH ya existe."
}

# 2. Instrucciones para el usuario
Write-Host "`nIMPORTANTE: Para completar la configuración, necesitamos copiar la llave pública al servidor."
Write-Host "Por favor, ejecuta el siguiente comando MANUALMENTE en tu terminal (te pedirá la contraseña 'Pr0s1s.2026'):"
Write-Host "`ntype $env:USERPROFILE\.ssh\id_rsa.pub | ssh -p $Port $User@$HostName `"padding; mkdir .ssh 2>NUL; cat >> .ssh/authorized_keys`""
Write-Host "`nUna vez hecho esto, podré conectarme automáticamente para gestionar la base de datos y despliegues."
