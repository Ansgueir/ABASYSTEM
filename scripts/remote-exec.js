const { spawn } = require('child_process');
const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrador';

async function runSsh(remoteCmd) {
    const child = spawn('ssh', ['-p', PORT, `${USER}@${HOST}`, remoteCmd], { shell: false });
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

const cmd = process.argv[2] || 'ls';
runSsh(cmd).then(() => process.exit(0));
