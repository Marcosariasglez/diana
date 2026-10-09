#!/usr/bin/env node
// Servidor estático de dist/ con fallback SPA para la suite E2E.
// Las peticiones a /e2e-sb/** jamás llegan aquí: las intercepta page.route
// en el navegador (e2e/supabaseMock.ts). Si alguna llega, algo falla en las rutas.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(fileURLToPath(import.meta.url), '..', '..', 'dist'));
const port = Number(process.env.E2E_PORT ?? 4319);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const end = (code, body, type) => {
    res.writeHead(code, {
      'Content-Type': type ?? 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  };
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/e2e-sb/')) {
      return end(404, 'e2e-sb: debería ser interceptada por page.route');
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = normalize(join(root, rel));
    if (!file.startsWith(root)) return end(403, 'forbidden');
    let target = file;
    const st = await stat(target).catch(() => null);
    if (st?.isDirectory()) target = join(target, 'index.html');
    const data = await readFile(target).catch(() => null);
    if (data) return end(200, data, MIME[extname(target).toLowerCase()] ?? 'application/octet-stream');
    // Fallback SPA: rutas profundas de expo-router sirven index.html.
    const idx = await readFile(join(root, 'index.html'));
    return end(200, idx, MIME['.html']);
  } catch {
    return end(500, 'internal error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[e2e] servidor estático en http://127.0.0.1:${port} (raíz: dist/)`);
});
