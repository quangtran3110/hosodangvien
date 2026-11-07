const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/styles.css', ['styles.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']]]);
http.createServer((req, res) => {
  const item = allowed.get(new URL(req.url, 'http://localhost').pathname);
  if (!item) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': item[1] + '; charset=utf-8', 'Cache-Control': 'no-store' });
  fs.createReadStream(path.join(root, item[0])).pipe(res);
}).listen(8766, '127.0.0.1', () => console.log('Local: http://127.0.0.1:8766'));
