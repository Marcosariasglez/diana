import fs from 'fs';
import path from 'path';

const src = fs.readFileSync(path.resolve(__dirname, '../../app/(tabs)/_layout.tsx'), 'utf-8');

describe('Layout de pestanas', () => {
  it('usa Tabs con BottomNav y no Stack', () => {
    expect(src).toContain('<Tabs');
    expect(src).toContain('BottomNav');
    expect(src).not.toContain('<Stack');
  });

  it('declara 4 pestanas y la Ficha oculta con href null', () => {
    for (const name of ['index', 'mood', 'match', 'profile']) {
      expect(src).toContain(`name="${name}"`);
    }
    expect(src).toMatch(/name="detail\/\[id\]"\s+options=\{\{\s*href:\s*null/);
  });
});
