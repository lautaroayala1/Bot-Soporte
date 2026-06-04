// server.js — Servidor de transcripts para Railway
// POST /upload  → recibe { hash, html } y guarda el archivo
// GET  /t/:hash → sirve el HTML guardado

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

// En Railway el filesystem es efímero pero /tmp siempre existe y tiene permisos
const DATA_DIR = process.env.DATA_DIR || '/tmp/transcripts';

// Crear carpeta si no existe (con manejo de error explícito)
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`[Init] Carpeta de transcripts: ${DATA_DIR}`);
} catch (err) {
  console.error(`[Init] ERROR al crear carpeta ${DATA_DIR}:`, err.message);
  process.exit(1);
}

function isValidHash(h) {
  return typeof h === 'string' && /^[a-f0-9]{40}$/.test(h);
}

function filePath(hash) {
  return path.join(DATA_DIR, `${hash}.html`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 20_000_000) { req.destroy(); reject(new Error('Body demasiado grande')); }
    });
    req.on('end',   () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url    = req.url || '/';
  const method = req.method || 'GET';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  // GET / → health check
  if (method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      service: 'VortexGG Transcript Server',
      data_dir: DATA_DIR,
    }));
  }

  // POST /upload → guardar transcript
  if (method === 'POST' && url === '/upload') {
    try {
      const body = await readBody(req);

      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'JSON inválido' }));
      }

      const { hash, html } = parsed;

      if (!isValidHash(hash)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Hash inválido' }));
      }
      if (typeof html !== 'string' || html.length < 10) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'HTML inválido o vacío' }));
      }

      fs.writeFileSync(filePath(hash), html, 'utf8');
      console.log(`[Upload] ✅ Transcript guardado: ${hash} (${html.length} bytes)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, hash }));

    } catch (err) {
      console.error('[Upload] ❌ Error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // GET /t/:hash → servir transcript
  const matchView = url.match(/^\/t\/([a-f0-9]{40})$/);
  if (method === 'GET' && matchView) {
    const hash = matchView[1];
    const fp   = filePath(hash);

    if (!fs.existsSync(fp)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title>
        <style>body{background:#0e0f13;color:#e4e6f0;font-family:sans-serif;
        display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
        h1{color:#f05a5a;}p{color:#6b7280;}</style></head>
        <body><div style="text-align:center"><h1>404</h1>
        <p>Transcript no encontrado o expirado.</p></div></body></html>`);
    }

    const html = fs.readFileSync(fp, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // 404 genérico
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Transcript server corriendo en puerto ${PORT}`);
  console.log(`   Transcripts en: ${DATA_DIR}`);
});
