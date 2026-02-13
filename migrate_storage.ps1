$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Migrating PostgreSQL Storage to Disk 2 ===" -ForegroundColor Cyan
Write-Host "Source: /var/lib/postgresql (Disk 1)"
Write-Host "Target: /mnt/db_data/postgresql (Disk 2)"

# Steps:
# 1. Stop Service
# 2. Sync Data (Rsync) - preserving permissions/ownership
# 3. Update postgresql.conf data_directory
# 4. Restart Service

$BashCommand = @"
set -e
echo '--> Stopping PostgreSQL...'
sudo systemctl stop postgresql

echo '--> Syncing Data...'
# Determine source and target paths
SOURCE_DIR='/var/lib/postgresql/'
TARGET_DIR='/mnt/db_data/postgresql/'

# Ensure parent target exists
sudo mkdir -p /mnt/db_data/postgresql

# Rsync contents. -a preserves archive/owners. --delete ensures exact copy.
sudo rsync -av --delete `$SOURCE_DIR `$TARGET_DIR

echo '--> Updating Configuration...'
CONF_FILE='/etc/postgresql/12/main/postgresql.conf'
# Backup config
sudo cp `$CONF_FILE `$CONF_FILE.bak
# Replace data_directory line
sudo sed -i "s|data_directory = '/var/lib/postgresql/12/main'|data_directory = '/mnt/db_data/postgresql/12/main'|g" `$CONF_FILE

echo '--> Restarting PostgreSQL...'
sudo systemctl start postgresql

echo '--> Verifying...'
sudo -u postgres psql -c 'SHOW data_directory;'
"@

# Execute via SSH
ssh -t -p $RemotePort $RemoteUser@$RemoteHost $BashCommand

Write-Host "=== Migration Complete ===" -ForegroundColor Green
