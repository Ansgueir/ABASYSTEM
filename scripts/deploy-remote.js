
const { spawn } = require('child_process');

const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrator';
const REMOTE_PATH = '/home/administrador/aba-supervision-system';

// Files to upload
const FILES = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'next.config.ts',
    'tailwind.config.ts',
    'postcss.config.mjs',
    'eslint.config.mjs',
    'components.json',
    '.env',
    'src',
    'prisma',
    'public',
    'scripts'
];

function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        console.log(`Executing: ${cmd} ${args.join(' ')}`);
        // Use shell: true to handle file globbing/args better on Windows if needed, 
        // but for exact files it's safer without.
        const child = spawn(cmd, args, { shell: true });

        let sentPassword = false;

        let buffer = '';

        const handleData = (data) => {
            const str = data.toString();
            process.stdout.write(str);
            buffer += str;
            // Keep buffer size manageable? Not strictly necessary for short prompts.

            // Check recent output for password prompt
            const recent = buffer.slice(-200);
            if (recent.toLowerCase().includes('password:') && !sentPassword) {
                console.log(' [DEBUG: Detected prompt, writing password...]');
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true; // Set flag to avoid loop if prompt remains in buffer?
                // Actually reset flag if we want to handle retry? 
                // But for now assume one prompt per command execution. 
                // SSH might prompt again if wrong. 
                // Let's rely on re-running if needed, or clear sentPassword if we see "try again".
            }
            if (recent.toLowerCase().includes('try again')) {
                sentPassword = false;
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
        console.log('=== Starting Autonomous Repair & Deployment ===');

        // 1. Mkdir
        console.log('\n--- Step 1: Ensure directory exists ---');
        await runCommand('ssh', ['-p', PORT, `${USER}@${HOST}`, `"mkdir -p ${REMOTE_PATH}"`]);

        // 2. Upload
        console.log('\n--- Step 2: Upload Files (using scp) ---');
        // Construct scp command. scp -P port -r file1 file2 ... user@host:path
        // On Windows spawning scp with multiple files can be tricky with quoting.
        // We'll pass the files as separate arguments.
        const scpArgs = ['-P', PORT, '-r', ...FILES, `${USER}@${HOST}:${REMOTE_PATH}`];
        await runCommand('scp', scpArgs);

        // 3. Migrate and Build
        console.log('\n--- Step 3: Install, Migrate & Build ---');
        const buildCmd = `cd ${REMOTE_PATH} && npm install --legacy-peer-deps && npx prisma generate && npx prisma migrate deploy && npm run build`;
        await runCommand('ssh', ['-p', PORT, `${USER}@${HOST}`, `"${buildCmd}"`]);

        // 4. Restart
        console.log('\n--- Step 4: Restart PM2 ---');
        const restartCmd = `cd ${REMOTE_PATH} && pm2 restart aba-supervision-system || pm2 start npm --name "aba-supervision-system" -- start`;
        await runCommand('ssh', ['-p', PORT, `${USER}@${HOST}`, `"${restartCmd}"`]);

        console.log('\n=== Deployment Success! ===');
    } catch (e) {
        console.error('\n❌ Deployment Failed:', e);
        process.exit(1);
    }
}

main();
