#!/usr/bin/env node
/**
 * scripts/serve-spa.mjs — servidor estático con «fallback» a index.html (SPA).
 * Uso: node scripts/serve-spa.mjs <carpeta-con-el-build> [puerto=3111]
 */
import http from 'http';
import fs from 'fs';
import path from 'path';

const root = path.resolve(process.argv[2] ?? 'dist');
const port = Number(process.argv[3] ?? 3111);
const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`sirviendo ${root} en http://localhost:${port}`));
