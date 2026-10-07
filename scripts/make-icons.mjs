// Genera los iconos de la PWA en public/ a partir de assets/images/icon.png. Uso: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
const src = new URL('../assets/images/icon.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [name, size] of targets) {
  const out = new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  await sharp(src).resize(size, size, { fit: 'cover' }).png().toFile(out);
  console.log('creado public/' + name);
}
