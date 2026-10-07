import fs from 'fs';
import path from 'path';
import { ROUTES } from '@/constants/routes';

const root = path.resolve(__dirname, '../..');

describe('Bottom nav', () => {
  it('app/(tabs) contiene exactamente las pestanas y la Ficha', () => {
    const dir = path.join(root, 'app', '(tabs)');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d)) {
        const f = path.join(d, e);
        if (fs.statSync(f).isDirectory()) walk(f);
        else if (!e.startsWith('_layout')) files.push(path.relative(dir, f).split(path.sep).join('/'));
      }
    };
    walk(dir);
    expect(files.sort()).toEqual(
      ['detail/[id].tsx', 'index.tsx', 'match.tsx', 'mood.tsx', 'profile.tsx'].sort(),
    );
  });

  it('solo las rutas de (tabs) tienen bottomNav', () => {
    for (const r of ROUTES) {
      expect(r.bottomNav).toBe(r.file.startsWith('app/(tabs)/'));
    }
  });
});
