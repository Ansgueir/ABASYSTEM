$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Migrating Storage (Base64 Safe Mode) ===" -ForegroundColor Cyan

# The Bash script content (Pure Linux syntax)
$BashScript = @"
set -e
echo '--> Stopping PostgreSQL...'
systemctl stop postgresql

echo '--> Syncing Data...'
mkdir -p /mnt/db_data/postgresql
rsync -av /var/lib/postgresql/ /mnt/db_data/postgresql/

echo '--> Updating Configuration...'
cp /etc/postgresql/12/main/postgresql.conf /etc/postgresql/12/main/postgresql.conf.bak
sed -i "s#data_directory = '/var/lib/postgresql/12/main'#data_directory = '/mnt/db_data/postgresql/12/main'#g" /etc/postgresql/12/main/postgresql.conf

echo '--> Restarting PostgreSQL...'
systemctl start postgresql
sleep 2

echo '--> Verifying...'
sudo -u postgres psql -c 'SHOW data_directory;'
"@

# Encode to Base64
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($BashScript)
$Encoded = [System.Convert]::ToBase64String($Bytes)

Write-Host "Paylod Size: $($Encoded.Length)"

# Command to decode, sanitize, and execute on the server
# We use tr -d '\r' to strip any Windows carriage returns that might have been encoded
$RemoteCommand = "echo '$Encoded' | base64 -d | tr -d '\r' > /tmp/migrate_final.sh && chmod +x /tmp/migrate_final.sh && sudo bash /tmp/migrate_final.sh"
ssh -t -p $RemotePort $RemoteUser@$RemoteHost $RemoteCommand
