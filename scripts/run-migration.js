const { spawn } = require('child_process');

const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrator';
const REMOTE_PATH = '/home/administrador/aba-supervision-system';

function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${cmd} ${args.join(' ')}`);
        const child = spawn(cmd, args, { shell: true });

        let sentPassword = false;
        let buffer = '';

        const handleData = (data) => {
            const str = data.toString();
            process.stdout.write(str);
            buffer += str;

            const recent = buffer.slice(-200);
            if (recent.toLowerCase().includes('password:') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        };

        child.stdout.on('data', handleData);
        child.stderr.on('data', handleData);

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

async function main() {
    try {
        console.log('=== Starting Remote Database Migration (Supabase -> Local PG) ===');

        // Execute the migration script on the server
        const migrateCmd = `cd ${REMOTE_PATH} && bash migrate_supabase_to_local.sh`;
        await runCommand('ssh', ['-p', PORT, `${USER}@${HOST}`, `"${migrateCmd}"`]);

        console.log('\n=== Migration Success! ===');
    } catch (e) {
        console.error('\n❌ Migration Failed:', e);
        process.exit(1);
    }
}

main();
