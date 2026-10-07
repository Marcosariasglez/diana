import fs from 'fs';
import path from 'path';

describe('PWA configuration', () => {
  const root = path.resolve(__dirname, '../..');

  it('package.json has build:web, icons, and rls scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    expect(pkg.scripts['build:web']).toBeDefined();
    expect(pkg.scripts.icons).toBeDefined();
    expect(pkg.scripts.rls).toBeDefined();
  });

  it('public/icon-192.png exists', () => {
    expect(fs.existsSync(path.join(root, 'public', 'icon-192.png'))).toBe(true);
  });

  it('public/icon-512.png exists', () => {
    expect(fs.existsSync(path.join(root, 'public', 'icon-512.png'))).toBe(true);
  });

  it('public/apple-touch-icon.png exists', () => {
    expect(fs.existsSync(path.join(root, 'public', 'apple-touch-icon.png'))).toBe(true);
  });

  it('app.config.ts contains output: single', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(config).toContain("output: 'single'");
  });

  it('app.config.ts references process.env.EXPO_BASE_URL', () => {
    const config = fs.readFileSync(path.join(root, 'app.config.ts'), 'utf8');
    expect(config).toContain('process.env.EXPO_BASE_URL');
  });
});
