import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf-8');

const FILES = [
  'src/components/features/SwipeCard.tsx',
  'src/components/features/SlotReveal.tsx',
  'src/components/features/WizardQuestion.tsx',
];

describe('Reglas de animacion (seccion 10)', () => {
  it.each(FILES)('%s no usa setTimeout, overshootify ni useAnimatedScrollHandler', (file) => {
    const src = read(file);
    expect(src).not.toMatch(/setTimeout/);
    expect(src).not.toMatch(/overshootify/);
    expect(src).not.toMatch(/useAnimatedScrollHandler/);
  });

  it.each(FILES)('%s pasa al hilo JS con toJS (no runOnJS directo)', (file) => {
    const src = read(file);
    expect(src).toMatch(/toJS\(/);
    expect(src).not.toMatch(/runOnJS/);
  });

  it('SwipeCard resuelve la direccion con resolveDirection', () => {
    expect(read('src/components/features/SwipeCard.tsx')).toMatch(/resolveDirection\(/);
  });

  it('toJS usa scheduleOnRN (runOnJS esta deprecado)', () => {
    const src = read('src/utils/worklets.ts');
    expect(src).toMatch(/scheduleOnRN/);
    expect(src).toMatch(/export function toJS/);
  });
});
