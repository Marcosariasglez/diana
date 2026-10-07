import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve(__dirname, '../../app/_layout.tsx'), 'utf-8');

describe('Guard de onboarding (estatico)', () => {
  it('no renderiza rutas hasta que fuentes y stores estan listos', () => {
    expect(src).toContain('useStoresHydrated');
    expect(src).toMatch(/if \(!ready\) return null/);
  });

  it('redirige segun hasOnboarded con Redirect y useSegments', () => {
    expect(src).toContain('<Redirect href="/welcome"');
    expect(src).toContain('<Redirect href="/"');
    expect(src).toContain('useSegments');
  });

  it('registra todas las pantallas siempre', () => {
    for (const n of ['(onboarding)', '(tabs)', 'mood-wizard', 'mood-results', 'daily-log', 'notifications', 'room/join']) {
      expect(src).toContain(`name="${n}"`);
    }
  });
});
