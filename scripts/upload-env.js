const { spawn } = require('child_process');
const PASSWORD = 'Pr0s1s.2026';
const HOST = '170.55.79.9';
const PORT = '22022';
const USER = 'administrador';

async function upload() {
    console.log('--- Uploading server.env as .env ---');
    const child = spawn('scp', ['-P', PORT, 'server.env', `${USER}@${HOST}:/home/administrador/aba-supervision-system/.env`], { shell: true });
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

upload().then(() => process.exit(0));
