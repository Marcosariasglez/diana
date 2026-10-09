// Tras `expo export --platform web`: genera dist/manifest.json y anade las etiquetas PWA a dist/index.html.
// Usa EXPO_BASE_URL (por ejemplo "/diana"; vacio si hay dominio propio). Uso: node scripts/postbuild-pwa.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const base = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');
const dist = new URL('../dist/', import.meta.url);
const indexPath = new URL('index.html', dist);
if (!existsSync(indexPath)) {
  console.error('BLOQUEADO: no existe dist/index.html. Ejecuta antes `npx expo export --platform web`.');
  process.exit(2);
}

const manifest = {
  name: 'Diana · Tu cine, con tu gusto.',
  short_name: 'Diana',
  description: 'Encuentra tu próxima película favorita en segundos',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F4F3EF',
  theme_color: '#0B7A66',
  icons: [
    { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
writeFileSync(new URL('manifest.json', dist), JSON.stringify(manifest, null, 2));

let html = readFileSync(indexPath, 'utf8');
const tags = [
  `<link rel="manifest" href="${base}/manifest.json" />`,
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />`,
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="Diana" />',
  '<meta name="theme-color" content="#0B7A66" />',
  '<meta name="theme-color" content="#0A0C0F" media="(prefers-color-scheme: dark)" />',
]
  .filter((t) => !(t.includes('name="theme-color"') && html.includes('name="theme-color"'))) // Expo ya lo pone con web.themeColor
  .join('\n    ');

// viewport con viewport-fit=cover para el notch de iPhone
if (/<meta[^>]+name="viewport"[^>]*>/.test(html)) {
  html = html.replace(/<meta[^>]+name="viewport"[^>]*>/, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
} else {
  html = html.replace('</head>', '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n  </head>');
}
if (!html.includes('rel="manifest"')) html = html.replace('</head>', `    ${tags}\n  </head>`);
writeFileSync(indexPath, html);
console.log(`PWA lista (base "${base || '/'}"): dist/manifest.json y dist/index.html parcheados.`);
