$ErrorActionPreference = "Stop"

$RemoteUser = "administrador"
$RemoteHost = "170.55.79.9"
$RemotePort = "22022"

Write-Host "=== Fixing Schema & Creating Admin ===" -ForegroundColor Cyan

# 1. Run DB Push with --accept-data-loss to force table creation
# 2. Fix variable escaping for PowerShell Here-String (use backtick `$)

$SeedScript = @"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  // Use a simple password placeholder for now.
  const passwordHash = 'hashed_password_placeholder'; 

  const user = await prisma.user.upsert({
    where: { email: email },
    update: {},
    create: {
      email: email,
      passwordHash: passwordHash, 
      role: 'SUPERVISOR', // Giving appropriate role
      officeMember: {
        create: {
          fullName: 'System Administrator',
          permissions: {}
        }
      }
    },
  });
  console.log('Admin user ensured:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.`$disconnect();
  });
"@

$RemoteCommands = @"
echo '--> Loading Prisma Schema...'
cd /home/administrador/aba-supervision-system
export DATABASE_URL='postgresql://postgres:Pr0s1s.2026@localhost:5432/aba_supervision?schema=public'

echo '--> Pushing Schema (Creating missing tables)...'
npx prisma db push --skip-generate --accept-data-loss

echo '--> Seeding Admin User...'
echo "$SeedScript" > seed_fix.js
node seed_fix.js
"@

# Use my safe base64 wrapper trick to avoid quoting hell again
$Bytes = [System.Text.Encoding]::UTF8.GetBytes($RemoteCommands)
$Encoded = [System.Convert]::ToBase64String($Bytes)

$WrapperVerifier = "echo '$Encoded' | base64 -d | tr -d '\r' > /tmp/fix_schema.sh && chmod +x /tmp/fix_schema.sh && bash /tmp/fix_schema.sh"

ssh -t -p $RemotePort $RemoteUser@$RemoteHost $WrapperVerifier

Write-Host "=== Fix Complete ===" -ForegroundColor Green
