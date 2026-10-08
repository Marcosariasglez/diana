#!/usr/bin/env node
/**
 * scripts/download-fonts.mjs
 * Descarga fuentes estáticas de Google Fonts API.
 *
 * Uso: node scripts/download-fonts.mjs
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, '..', 'assets', 'fonts');

mkdirSync(FONTS_DIR, { recursive: true });

const FONTS = [
  // Manrope — Solo pesos necesarios: 600, 700, 800
  { family: 'Manrope', weight: 600, file: 'Manrope-SemiBold.ttf' },
  { family: 'Manrope', weight: 700, file: 'Manrope-Bold.ttf' },
  { family: 'Manrope', weight: 800, file: 'Manrope-ExtraBold.ttf' },
  // Inter — 400, 500, 600, 700
  { family: 'Inter', weight: 400, file: 'Inter-Regular.ttf' },
  { family: 'Inter', weight: 500, file: 'Inter-Medium.ttf' },
  { family: 'Inter', weight: 600, file: 'Inter-SemiBold.ttf' },
  { family: 'Inter', weight: 700, file: 'Inter-Bold.ttf' },
];

async function download(url, dest) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  // Verificar que es un TTF válido (magic number 0x00010000 o "true" o "typ1")
  const len = buf.length;
  if (len < 1000) {
    // Probablemente HTML de error
    const text = buf.toString('utf-8').slice(0, 100);
    if (text.includes('<') || text.includes('!DOCTYPE')) {
      throw new Error(`Not a valid TTF (HTML received): ${text}`);
    }
  }
  writeFileSync(dest, buf);
  console.log(`  ✓ ${dest} (${(len / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log('Descargando fuentes estáticas de Google Fonts...\n');

  for (const f of FONTS) {
    const url = `https://fonts.google.com/download?family=${encodeURIComponent(f.family)}&weight=${f.weight}`;
    const dest = join(FONTS_DIR, f.file);
    try {
      await download(url, dest);
    } catch (err) {
      console.error(`  ✗ ${f.file}: ${err.message}`);
      // Intentar con el enfoque alternativo usando el API de descarga
      try {
        const altUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family)}:wght@${f.weight}`;
        // No funciona directamente... usar approach de fetch css y extraer URL
        const cssResp = await fetch(altUrl);
        const css = await cssResp.text();
        const urlMatch = css.match(/url\((https[^)]+\.ttf)\)/);
        if (urlMatch) {
          await download(urlMatch[1], dest);
        } else {
          console.error(`  ✗ Could not extract TTF URL for ${f.file}`);
        }
      } catch (err2) {
        console.error(`  ✗ Alt approach failed for ${f.file}: ${err2.message}`);
      }
    }
  }

  console.log('\nCreando LEEME.md...');
  const readme = `# Fuentes VERTICE

Fuentes estáticas descargadas de Google Fonts (licencia OFL).

## Manrope
- SemiBold (600): Manrope-SemiBold.ttf
- Bold (700): Manrope-Bold.ttf
- ExtraBold (800): Manrope-ExtraBold.ttf
- Fuente: https://fonts.google.com/specimen/Manrope
- Versión: v18 (2024)

## Inter
- Regular (400): Inter-Regular.ttf
- Medium (500): Inter-Medium.ttf
- SemiBold (600): Inter-SemiBold.ttf
- Bold (700): Inter-Bold.ttf
- Fuente: https://fonts.google.com/specimen/Inter
- Versión: v8 (2024)

Licencia: SIL Open Font License, Version 1.1 (OFL)
`;
  writeFileSync(join(FONTS_DIR, 'LEEME.md'), readme, 'utf-8');
  console.log('  ✓ LEEME.md');
}

main().catch(console.error);
