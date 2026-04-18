// Migration: add ContractGroupAssignment + run existing OfficeGroup migration if needed
const fs = require('fs')
const path = require('path')
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
    console.log('Running ContractGroupAssignment migration...')

    await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ContractGroupAssignment" (
            "id" TEXT NOT NULL,
            "contractId" TEXT NOT NULL,
            "supervisorId" TEXT NOT NULL,
            "officeGroupId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "ContractGroupAssignment_pkey" PRIMARY KEY ("id")
        )
    `)
    console.log('ContractGroupAssignment table OK')

    await p.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "ContractGroupAssignment_contractId_supervisorId_officeGroupId_key"
        ON "ContractGroupAssignment"("contractId", "supervisorId", "officeGroupId")
    `)

    await p.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "ContractGroupAssignment_contractId_idx"
        ON "ContractGroupAssignment"("contractId")
    `)

    try {
        await p.$executeRawUnsafe(`
            ALTER TABLE "ContractGroupAssignment"
            ADD CONSTRAINT "ContractGroupAssignment_contractId_fkey"
            FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `)
    } catch (e) { console.log('FK contractId already exists') }

    try {
        await p.$executeRawUnsafe(`
            ALTER TABLE "ContractGroupAssignment"
            ADD CONSTRAINT "ContractGroupAssignment_supervisorId_fkey"
            FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `)
    } catch (e) { console.log('FK supervisorId already exists') }

    try {
        await p.$executeRawUnsafe(`
            ALTER TABLE "ContractGroupAssignment"
            ADD CONSTRAINT "ContractGroupAssignment_officeGroupId_fkey"
            FOREIGN KEY ("officeGroupId") REFERENCES "OfficeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `)
    } catch (e) { console.log('FK officeGroupId already exists') }

    console.log('\nMigration complete! ContractGroupAssignment table ready.')
}

main()
    .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
    .finally(() => p.$disconnect())
