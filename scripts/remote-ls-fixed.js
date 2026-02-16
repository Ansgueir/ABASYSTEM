const { spawn } = require('child_process');
const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrator';
const REMOTE_PATH = '/home/administrador/aba-supervision-system';

async function runSsh(remoteCmd) {
    const child = spawn('ssh', ['-p', PORT, `${USER}@${HOST}`, remoteCmd], { shell: true });
    let sentPassword = false;

    return new Promise((resolve, reject) => {
        child.stdout.on('data', (d) => {
            const out = d.toString();
            process.stdout.write(out);
            if (out.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });
        child.stderr.on('data', (d) => {
            const out = d.toString();
            process.stderr.write(out);
            if (out.toLowerCase().includes('password') && !sentPassword) {
                child.stdin.write(PASSWORD + '\n');
                sentPassword = true;
            }
        });
        child.on('close', resolve);
    });
}

runSsh(`ls -F ${REMOTE_PATH}`).then(() => process.exit(0));
