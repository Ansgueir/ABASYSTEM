// Run migration: create OfficeGroup + OfficeGroupSupervisor tables
require('dotenv').config({ path: '.env' })
const { execSync } = require('child_process')
const fs = require('fs')

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL not found'); process.exit(1) }

console.log('Running migration...')
const sql = fs.readFileSync('migrate_office_groups.sql', 'utf8')

// Use psql via DATABASE_URL
try {
    execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { stdio: 'inherit' })
} catch(e) {
    // psql may not be available, use prisma db execute instead
    console.log('psql not available, using node-postgres...')
    const { Client } = require('pg')
    const client = new Client({ connectionString: dbUrl })
    client.connect().then(() => {
        return client.query(sql)
    }).then(() => {
        console.log('Migration applied successfully')
        return client.end()
    }).catch(err => {
        console.error('Migration error:', err.message)
        return client.end().then(() => process.exit(1))
    })
}
