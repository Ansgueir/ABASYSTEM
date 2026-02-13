
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    host: '170.55.79.9',
    port: '22022',
    user: 'administrador',
    pass: 'Pr0s1s.2026',
    remotePath: '/home/administrador/aba-supervision-system',
    localArchive: 'deployment.tar.gz'
};

function spawnChild(command, args, description) {
    return new Promise((resolve, reject) => {
        console.log(`\n[${description}] Executing: ${command} ${args.join(' ')}`);

        const child = spawn(command, args, { shell: true });

        let passwordSent = false;
        let buffer = '';

        // Anti-stuck: Force send password if no prompt seen in 5 seconds (fallback)
        const watchdog = setTimeout(() => {
            if (!passwordSent) {
                console.log(' [Watchdog] No prompt detected yet, sending password anyway...');
                child.stdin.write(CONFIG.pass + '\n');
                passwordSent = true;
            }
        }, 5000);

        child.stdout.on('data', (data) => {
            const str = data.toString();
            process.stdout.write(str); // Passthrough to user
            buffer += str;

            // Check for password prompt
            if (!passwordSent && (str.toLowerCase().includes('password:') || str.includes('KB)'))) {
                console.log(' [Prompt Detected] Sending password...');
                child.stdin.write(CONFIG.pass + '\n');
                passwordSent = true;
            }
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            process.stdout.write(str); // Passthrough
            buffer += str;

            if (!passwordSent && str.toLowerCase().includes('password:')) {
                console.log(' [Prompt Detected on STDERR] Sending password...');
                child.stdin.write(CONFIG.pass + '\n');
                passwordSent = true;
            }
        });

        child.on('close', (code) => {
            clearTimeout(watchdog);
            if (code === 0) {
                console.log(`[${description}] Success (Code 0)`);
                resolve();
            } else {
                console.error(`[${description}] Failed with code ${code}`);
                reject(new Error(`Exit code ${code}`));
            }
        });

        child.on('error', (err) => {
            clearTimeout(watchdog);
            reject(err);
        });
    });
}

async function main() {
    try {
        if (!fs.existsSync(CONFIG.localArchive)) {
            throw new Error(`Archive ${CONFIG.localArchive} not found! Run tar command first.`);
        }

        // 1. Upload Tarball
        await spawnChild(
            'scp',
            ['-P', CONFIG.port, CONFIG.localArchive, `${CONFIG.user}@${CONFIG.host}:${CONFIG.remotePath}/`],
            'Step 1: Upload Archive'
        );

        // 2. Extract & Install
        // Combined command to reduce SSH connection attempts
        const remoteCmd = [
            `cd ${CONFIG.remotePath}`,
            `tar -xzf ${CONFIG.localArchive}`,
            `rm ${CONFIG.localArchive}`, // cleanup
            `echo "--- Installing Deps ---"`,
            `npm install --legacy-peer-deps`,
            `echo "--- Prisma Generate ---"`,
            `npx prisma generate`,
            `echo "--- Prisma Migrate ---"`,
            `npx prisma migrate deploy`, // WARNING: This needs DB access.
            `echo "--- Build ---"`,
            `npm run build`,
            `echo "--- PM2 Restart ---"`,
            `pm2 restart aba-supervision-system || pm2 start npm --name "aba-supervision-system" -- start`
        ].join(' && ');

        await spawnChild(
            'ssh',
            ['-p', CONFIG.port, `${CONFIG.user}@${CONFIG.host}`, `"${remoteCmd}"`],
            'Step 2: Remote Setup (Extract, Install, Build, Restart)'
        );

        console.log('\n\n✅✅✅ DEPLOYMENT COMPLETE ✅✅✅');

    } catch (err) {
        console.error('\n❌ Deployment Failed:', err.message);
        process.exit(1);
    }
}

main();
