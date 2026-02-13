$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Generating Hash for '123456' ===" -ForegroundColor Cyan

$JsScript = @"
try {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('123456', 10);
  console.log('HASH:' + hash);
} catch (e) {
  console.error(e);
}
"@

$Bytes = [System.Text.Encoding]::UTF8.GetBytes($JsScript)
$Encoded = [System.Convert]::ToBase64String($Bytes)

$RemoteCommand = "echo '$Encoded' | base64 -d > /tmp/gen_hash.js && cd /home/administrador/aba-supervision-system && node /tmp/gen_hash.js"

ssh -p $RemotePort $RemoteUser@$RemoteHost $RemoteCommand
