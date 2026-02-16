const { spawn } = require('child_process');
const fs = require('fs');
const logFile = 'migration_log.txt';

const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrator';
const REMOTE_PATH = '/home/administrador/aba-supervision-system';

function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

async function runSsh(remoteCmd) {
    const child = spawn('ssh', ['-p', PORT, `${USER}@${HOST}`, remoteCmd], { shell: true });
    let sentPassword = false;

    return new Promise((resolve, reject) => {
        child.stdout.on('data', (d) => {
            const out = d.toString();
            fs.appendFileSync(logFile, out);
            if (out.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });
        child.stderr.on('data', (d) => {
            const out = d.toString();
            fs.appendFileSync(logFile, out);
            if (out.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });
        child.on('close', resolve);
    });
}

fs.writeFileSync(logFile, '--- Migration Log Start ---\n');
runSsh(`cd ${REMOTE_PATH} && bash migrate_supabase_to_local.sh`).then(() => {
    log('--- Finished ---');
    process.exit(0);
});
