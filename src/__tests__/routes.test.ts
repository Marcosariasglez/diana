import fs from 'fs';
import path from 'path';
import { ROUTES } from '@/constants/routes';

const root = path.resolve(__dirname, '../..');

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

describe('Manifiesto de rutas', () => {
  it('cada URL aparece una sola vez', () => {
    const urls = ROUTES.map((r) => r.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('cada archivo del manifiesto existe', () => {
    for (const r of ROUTES) {
      expect(fs.existsSync(path.join(root, r.file))).toBe(true);
    }
  });

  it('no hay archivos en app/ fuera del manifiesto (salvo layouts)', () => {
    const manifest = new Set(ROUTES.map((r) => path.join(root, r.file)));
    const extra = listFiles(path.join(root, 'app')).filter(
      (f) => !path.basename(f).startsWith('_layout') && !manifest.has(f),
    );
    expect(extra).toEqual([]);
  });

  it('incluye room/[code]/mood', () => {
    expect(ROUTES.some((r) => r.file === 'app/room/[code]/mood.tsx')).toBe(true);
  });
});
