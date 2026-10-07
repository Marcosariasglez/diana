import fs from 'fs';
import path from 'path';

describe('No emoji policy', () => {
  const root = path.resolve(__dirname, '../..');
  const dirsToCheck = ['src', 'app'];
  const emojiRegex = /\p{Extended_Pictographic}/u;

  function findFiles(dir: string, exts: string[]): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.git') {
          results.push(...findFiles(full, exts));
        }
      } else if (exts.some((e) => entry.endsWith(e))) {
        results.push(full);
      }
    }
    return results;
  }

  const files = dirsToCheck
    .flatMap((d) => path.join(root, d))
    .flatMap((d) => findFiles(d, ['.ts', '.tsx', '.js', '.jsx']));

  it('no files contain emoji characters', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(emojiRegex);
      if (match) {
        violations.push(`${file}: found emoji "${match[0]}"`);
      }
    }
    if (violations.length > 0) {
      fail(
        `Emojis found in ${violations.length} file(s):\n` +
          violations.join('\n'),
      );
    }
  });
});
