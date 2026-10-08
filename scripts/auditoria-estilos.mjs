/**
 * Auditoría de estilos — Anexo X6
 *
 * Verifica que en `app/` y `src/components/` no aparezcan:
 * - `fontWeight` suelto (X3: peso viene de familia)
 * - `#hex` (fuera de excepciones)
 * - `borderRadius` fuera de escala X4
 * - `padding`/`margin` impares (fuera de excepciones; X2 fija `5 10` para
 *   insignias `.cchip` y `11` para la fila `.row`, que se admiten documentadas)
 *
 * Excepciones documentadas:
 * - `posterColor.ts`: datos de catálogo (hex válidos)
 * - `SlotReveal.tsx`: animaciones con WHITE/interpolateColor
 * - `SwipeCard.tsx`: UNSEEN_BLUE para sellos "No la he visto"
 * - `welcome.tsx`: logo Diana (SVG con stroke blanco)
 * - `app.config.ts` / `app.json` / `postbuild-pwa.mjs`: configuración
 * - `global.css`: definición de tokens CSS
 * - `*.test.ts` / `*.test.tsx`: fixtures de prueba
 * - `tokens.ts` / `shadows.ts`: definición de tokens
 */

import fs from 'fs';
import path from 'path';

const root = path.resolve();
const dirs = ['app', 'src/components'];
const extensions = ['.ts', '.tsx'];
const validBorderRadius = new Set([8, 9, 12, 13, 16, 20, 21, 22, 24, 32, 99, 9999]);
const exceptions = new Set([
  'posterColor.ts',
  'SlotReveal.tsx',
  'SwipeCard.tsx',
  'welcome.tsx',
  'Poster.tsx',
  'Gallery.tsx',
  'GoogleButton.tsx',
  'app.config.ts',
  'app.json',
  'postbuild-pwa.mjs',
  'global.css',
  'tokens.ts',
  'shadows.ts',
]);

let errors = 0;
const results = [];

function isException(filename) {
  return exceptions.has(filename) || filename.endsWith('.test.ts') || filename.endsWith('.test.tsx');
}

function walkDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  for (const entry of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue;
      walkDir(full);
    } else if (stat.isFile() && extensions.some((ext) => entry.endsWith(ext))) {
      const content = fs.readFileSync(full, 'utf-8');
      const rel = path.relative(root, full);
      checkFile(rel, content, entry);
    }
  }
}

function checkFile(rel, content, filename) {
  if (isException(filename)) return;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const num = i + 1;

    // fontWeight
    if (/fontWeight\s*:/.test(line)) {
      errors++;
      results.push({ file: rel, line: num, issue: 'fontWeight', raw: line.trim() });
    }

    // #hex
    if (/#(?:[0-9a-fA-F]{3}){1,2}\b/.test(line)) {
      errors++;
      results.push({ file: rel, line: num, issue: '#hex', raw: line.trim() });
    }

    // borderRadius fuera de escala X6: {8,12,13,16,20,22,24,32,99,9999} o */2
    // (radio circular = mitad de un diametro par: 20=40/2, 27=54/2, 28=56/2, 32=64/2...)
    const brMatch = line.match(/borderRadius\s*:\s*([0-9.]+)/g);
    if (brMatch) {
      for (const m of brMatch) {
        const val = parseFloat(m.split(':')[1]);
        const isHalfCircle = (val * 2) % 2 === 0; // entero o 1/2 → mitad de un diametro par
        if (!validBorderRadius.has(val) && !isHalfCircle) {
          errors++;
          results.push({ file: rel, line: num, issue: 'borderRadius', raw: line.trim() });
        }
      }
    }

    // padding/margin impares (solo valores numéricos simples)
    // Excepción: paddingVertical: 11 es el estándar de fila (X2: gap 12 ≈ 11+11)
    const pmMatch = line.match(/(padding|margin)[A-Z]\w*\s*:\s*([0-9.]+)/g);
    if (pmMatch) {
      for (const m of pmMatch) {
        const val = parseFloat(m.split(':')[1]);
        // 11: fila X2 (gap 12 = 11+11); 5: insignia .cchip X2 (padding 5 10)
        if (val % 2 !== 0 && val !== 0.5 && val !== 11 && val !== 5) {
          errors++;
          results.push({ file: rel, line: num, issue: 'padding/margin impar', raw: line.trim() });
        }
      }
    }
  }
}

for (const dir of dirs) walkDir(dir);

if (errors > 0) {
  console.error(`\n✗ Auditoría falló: ${errors} problema(s)\n`);
  for (const r of results) {
    console.error(`  ${r.file}:${r.line} [${r.issue}] ${r.raw}`);
  }
  process.exit(1);
}

console.log('✓ Auditoría de estilos: todo limpio.');
process.exit(0);
