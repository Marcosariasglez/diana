import fs from 'fs';
import path from 'path';

describe('Project structure', () => {
  const root = path.resolve(__dirname, '../..');

  it('package.json has main set to expo-router/entry', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf-8'),
    );
    expect(pkg.main).toBe('expo-router/entry');
  });

  it('app.ts does not exist', () => {
    expect(fs.existsSync(path.join(root, 'app.ts'))).toBe(false);
  });

  it('tsconfig defines @/* alias pointing to src/*', () => {
    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf-8'),
    );
    expect(tsconfig.compilerOptions.paths['@/*']).toEqual(['./src/*']);
  });

  it('no test files inside app/ directory', () => {
    const appDir = path.join(root, 'app');
    if (!fs.existsSync(appDir)) {
      return;
    }
    function findTests(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
          results.push(...findTests(full));
        } else if (
          entry.includes('__tests__') ||
          entry.endsWith('.test.ts') ||
          entry.endsWith('.test.tsx')
        ) {
          results.push(full);
        }
      }
      return results;
    }
    expect(findTests(appDir)).toEqual([]);
  });

  it('theme files exist', () => {
    expect(fs.existsSync(path.join(root, 'src', 'theme', 'colors.ts'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, 'src', 'theme', 'spacing.ts'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(root, 'src', 'theme', 'shadows.ts'))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(root, 'src', 'theme', 'typography.ts')),
    ).toBe(true);
  });

  it('worklets.ts exists', () => {
    expect(
      fs.existsSync(path.join(root, 'src', 'utils', 'worklets.ts')),
    ).toBe(true);
  });
});
