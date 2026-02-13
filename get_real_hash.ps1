$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Generating Hash on Server ===" -ForegroundColor Cyan

$JsScript = @"
const bcrypt = require('bcryptjs');
console.log('HASH_START:' + bcrypt.hashSync('123456', 10) + ':HASH_END');
"@

# Write JS file safely
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($JsScript)
$Encoded = [System.Convert]::ToBase64String($Bytes)

$RemoteCommand = "echo '$Encoded' | base64 -d > /home/administrador/aba-supervision-system/gen_hash_v2.js && cd /home/administrador/aba-supervision-system && node gen_hash_v2.js"

ssh -p $RemotePort $RemoteUser@$RemoteHost $RemoteCommand
