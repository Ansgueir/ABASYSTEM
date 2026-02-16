const { spawn } = require('child_process');

const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrador';
const SCRIPT = 'migrate_supabase.sh';

function runSshOrScp(cmd, args) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${cmd} ${args.join(' ')}`);
        const child = spawn(cmd, args, { shell: true });

        let sentPassword = false;
        let buffer = '';

        child.stdout.on('data', (d) => {
            const str = d.toString();
            process.stdout.write(str);
            buffer += str;
            if (str.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });

        child.stderr.on('data', (d) => {
            const str = d.toString();
            process.stderr.write(str);
            buffer += str;
            if (str.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });

        child.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Exit code ${code}`));
        });
    });
}

async function main() {
    try {
        console.log('=== Starting Remote Data Migration (Supabase -> Disk 2 Local PG) ===');

        // 1. Upload script
        console.log('\n--- Step 1: Uploading script ---');
        await runSshOrScp('scp', ['-P', PORT, SCRIPT, `${USER}@${HOST}:/home/administrador/`]);

        // 2. Execute script
        console.log('\n--- Step 2: Executing script ---');
        // Note: use 'administrador' as per scripts/deploy-remote.js
        const remoteCmd = `chmod +x /home/administrador/${SCRIPT} && /home/administrador/${SCRIPT}`;
        await runSshOrScp('ssh', ['-p', PORT, `${USER}@${HOST}`, `"${remoteCmd}"`]);

        console.log('\n=== Migration Success! ===');
    } catch (e) {
        console.error('\n❌ Migration Failed:', e);
        process.exit(1);
    }
}

main();
