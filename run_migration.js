// Run SQL migration using bundled node_modules/pg
const fs = require('fs')
const path = require('path')

// Read DATABASE_URL from .env without dotenv
const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
const dbUrl = envFile.split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('DATABASE_URL='))
    ?.replace('DATABASE_URL=', '')
    .replace(/^["']|["']$/g, '')
    .trim()

if (!dbUrl) { console.error('DATABASE_URL not found in .env'); process.exit(1) }
console.log('Connecting to DB...')

const { Client } = require('./node_modules/pg')
const sql = fs.readFileSync(path.join(__dirname, 'migrate_office_groups.sql'), 'utf8')

const client = new Client({ connectionString: dbUrl })

client.connect()
    .then(() => {
        console.log('Running migration...')
        return client.query(sql)
    })
    .then(() => {
        console.log('Migration applied successfully!')
        return client.end()
    })
    .catch(err => {
        console.error('Migration error:', err.message)
        return client.end().catch(() => { }).then(() => process.exit(1))
    })
