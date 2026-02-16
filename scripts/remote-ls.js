const { spawn } = require('child_process');
const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrator';
const REMOTE_PATH = '/home/administrador/aba-supervision-system';

function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { shell: true });
        let sentPassword = false;
        let buffer = '';
        child.stdout.on('data', (d) => { process.stdout.write(d); buffer += d; if (buffer.includes('password:') && !sentPassword) { child.stdin.write(PASSWORD + '\n'); sentPassword = true; } });
        child.stderr.on('data', (d) => { process.stderr.write(d); buffer += d; if (buffer.includes('password:') && !sentPassword) { child.stdin.write(PASSWORD + '\n'); sentPassword = true; } });
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(code)));
    });
}

runCommand('ssh', ['-p', PORT, `${USER}@${HOST}`, `"ls -F ${REMOTE_PATH}"`]).catch(console.error);
