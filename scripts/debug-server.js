const http = require('http');
const server = http.createServer((req, res) => {
    console.log(`[DEBUG] Request: ${req.method} ${req.url}`);
    console.log(`[DEBUG] Headers:`, JSON.stringify(req.headers, null, 2));
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Debug Server OK\n');
});
console.log('Starting Debug Server on port 3000...');
server.listen(3000, '0.0.0.0');
