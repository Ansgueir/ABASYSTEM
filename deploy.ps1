$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"
$RemotePath = "/home/administrador/aba-supervision-system"

Write-Host "=== Starting Deployment to $RemoteHost ===" -ForegroundColor Cyan

# 1. Ensure Remote Directory Exists
Write-Host "Creating remote directory..."
ssh -p $RemotePort $RemoteUser@$RemoteHost "mkdir -p $RemotePath"

# 2. Upload Files
Write-Host "Uploading files (this may take a while)..."
$FilesToUpload = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "tailwind.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "components.json",
    ".env",
    "src",
    "prisma",
    "public",
    "scripts"
)

# Construct SCP command string because passing array directly safely is tricky involves joining
$FilesString = $FilesToUpload -join " "
# Invoke-Expression is risky but for this simple list it is fine, or just call scp directly with args
# scp requires multiple sources to be separate arguments.
# In PowerShell, we can just pass them as arguments.
scp -P $RemotePort -r package.json package-lock.json tsconfig.json next.config.ts tailwind.config.ts postcss.config.mjs eslint.config.mjs components.json .env src prisma public scripts "$RemoteUser@${RemoteHost}:${RemotePath}"

# 3. Remote Build
Write-Host "Running remote build..."
ssh -p $RemotePort $RemoteUser@$RemoteHost "cd $RemotePath && echo 'Installing dependencies...' && npm install --legacy-peer-deps && echo 'Generating Prisma Client...' && npx prisma generate && echo 'Building Next.js app...' && npm run build"

# 4. Restart Process
Write-Host "Restarting Application..."
ssh -p $RemotePort $RemoteUser@$RemoteHost "cd $RemotePath && pm2 restart aba-supervision-system || pm2 start npm --name 'aba-supervision-system' -- start"

Write-Host "=== Deployment Complete ===" -ForegroundColor Green
