#!/bin/bash
cd /home/administrador/aba-supervision-system

# Backup current .env
cp .env .env.backup

# Update DATABASE_URL
sed -i '/^DATABASE_URL=/d' .env
echo 'DATABASE_URL="postgresql://aba_admin:Pr0s1s.2026@localhost:5432/aba_supervision"' >> .env

echo "Updated .env:"
grep DATABASE_URL .env

echo ""
echo "Running Prisma migrate..."
npx prisma migrate deploy 2>&1 || npx prisma db push --accept-data-loss 2>&1

echo ""
echo "Running Prisma generate..."
npx prisma generate

echo "Done!"
