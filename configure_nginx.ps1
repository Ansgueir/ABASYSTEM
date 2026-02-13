$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Configuring Nginx Reverse Proxy on $RemoteHost ===" -ForegroundColor Cyan

# 1. Define Nginx Configuration
# We use a simple config that proxies all traffic from port 80 to localhost:3000
$NginxConfig = @"
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host `$host;
        proxy_cache_bypass `$http_upgrade;
    }
}
"@

# 2. Upload Config to Temp Location
Write-Host "Uploading configuration to temporary file..." -ForegroundColor Yellow
# We use simple echo to write the file, avoiding complex file transfer for a single string
# Escaping for PowerShell/Bash can be tricky, but this simple block should be safe.
$Command = "echo '$NginxConfig' > /tmp/aba_nginx_config"
ssh -p $RemotePort $RemoteUser@$RemoteHost $Command

# 3. Apply Configuration with Sudo
Write-Host "Applying Nginx configuration..." -ForegroundColor Yellow
Write-Host "NOTE: You may be prompted for the SERVER PASSWORD to authorize 'sudo'." -ForegroundColor Magenta

# We move the file to sites-enabled/default to override the default page
# Then we test the config and restart Nginx
$SudoCommand = "sudo mv /tmp/aba_nginx_config /etc/nginx/sites-available/default && sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl restart nginx"

# -t forces pseudo-terminal allocation so sudo can ask for password if needed
ssh -t -p $RemotePort $RemoteUser@$RemoteHost $SudoCommand

Write-Host "=== Nginx Configuration Complete! ===" -ForegroundColor Green
Write-Host "You should now be able to access the app at: http://$RemoteHost"
