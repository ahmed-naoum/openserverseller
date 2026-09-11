// Dev-only: forwards :3000 -> :3001 keeping the Host header intact, so
// `<sub>.localhost:3000/r/<code>` passes validateInfluencerHost (subdomain.ts
// recognises `.localhost:3000`) and the Express route serves the COMPILED page.
// Same origin means /api/v1/public/* rides through here too. Nothing else in
// the dev setup is touched.
const http = require('http');

http.createServer((req, res) => {
  const p = http.request(
    { host: '127.0.0.1', port: 3001, path: req.url, method: req.method, headers: req.headers },
    (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res); },
  );
  p.on('error', (e) => { console.error('[proxy]', e.code, req.url); if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(p);
}).listen(3000, () => console.log('SSG dev proxy: http://<sub>.localhost:3000 -> :3001'));
