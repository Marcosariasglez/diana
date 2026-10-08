/**
 * Descarga/genera las fuentes estáticas de Diana (Manrope 600/700/800 + Inter 400/500/600/700).
 *
 * Los TTF de assets/fonts son INSTANCIAS estáticas generadas con fontTools (Python) a
 * partir de las fuentes variables oficiales:
 *   - Manrope: assets/fonts/Manrope-VariableFont.ttf (wght 200-800)
 *   - Inter:   Inter[opsz,wght].ttf descargado de google/fonts (GitHub)
 *
 * El trabajo lo hace scripts/generate-fonts.py, que además VALIDA cada salida
 * (carga completa con fontTools + magic number 00010000/'true'/'OTTO').
 *
 * Uso:  npm run fonts   (o: node scripts/download-fonts.mjs)
 * Dep:  Python 3 + fonttools  (pip install fonttools)
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = path.join(root, 'scripts', 'generate-fonts.py');

const candidates = process.platform === 'win32' ? ['py', 'python'] : ['python3', 'python'];
let run = null;
for (const cmd of candidates) {
  const r = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  if (r.status === 0) {
    run = spawnSync(cmd, [script], { stdio: 'inherit', cwd: root });
    break;
  }
}

if (run === null || run.status !== 0) {
  console.error('✗ No se pudo generar las fuentes.');
  console.error('  Instala Python 3 y fonttools:  pip install fonttools');
  process.exit(1);
}
console.log('✓ Fuentes estáticas generadas y validadas en assets/fonts/');
