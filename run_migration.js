// Run migration using Prisma $executeRawUnsafe (no pg module needed)
const { PrismaClient } = require('./node_modules/@prisma/client')
const p = new PrismaClient()

async function main() {
    console.log('Running OfficeGroup migration...')

    await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OfficeGroup" (
            "id" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "groupType" TEXT NOT NULL,
            "dayOfWeek" TEXT NOT NULL,
            "startTime" TEXT NOT NULL,
            "endTime" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "OfficeGroup_pkey" PRIMARY KEY ("id")
        )
    `)
    console.log('OfficeGroup table OK')

    await p.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "OfficeGroup_groupType_dayOfWeek_key" ON "OfficeGroup"("groupType", "dayOfWeek")
    `)
    console.log('OfficeGroup unique index OK')

    await p.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "OfficeGroupSupervisor" (
            "id" TEXT NOT NULL,
            "groupId" TEXT NOT NULL,
            "supervisorId" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "OfficeGroupSupervisor_pkey" PRIMARY KEY ("id")
        )
    `)
    console.log('OfficeGroupSupervisor table OK')

    await p.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "OfficeGroupSupervisor_groupId_supervisorId_key"
        ON "OfficeGroupSupervisor"("groupId", "supervisorId")
    `)

    await p.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "OfficeGroupSupervisor_groupId_idx" ON "OfficeGroupSupervisor"("groupId")
    `)

    await p.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "OfficeGroupSupervisor_supervisorId_idx" ON "OfficeGroupSupervisor"("supervisorId")
    `)

    // Add FK constraints (skip if already exist)
    try {
        await p.$executeRawUnsafe(`
            ALTER TABLE "OfficeGroupSupervisor" ADD CONSTRAINT "OfficeGroupSupervisor_groupId_fkey"
            FOREIGN KEY ("groupId") REFERENCES "OfficeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `)
    } catch (e) { console.log('FK groupId already exists') }

    try {
        await p.$executeRawUnsafe(`
            ALTER TABLE "OfficeGroupSupervisor" ADD CONSTRAINT "OfficeGroupSupervisor_supervisorId_fkey"
            FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `)
    } catch (e) { console.log('FK supervisorId already exists') }

    console.log('\nMigration complete! OfficeGroup + OfficeGroupSupervisor tables ready.')
}

main()
    .catch(e => { console.error('ERROR:', e.message); process.exit(1) })
    .finally(() => p.$disconnect())
