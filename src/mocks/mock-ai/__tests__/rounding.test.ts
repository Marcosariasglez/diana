import fs from 'fs';
import path from 'path';
import { roundDiv } from '@/utils/intMath';
import { bucketOfTenths, predict, tenthsFromScoreBp } from '../predict';

const TABLE: Array<[string, number, number, number, string]> = [
  ['R1', 4750, 40, 4.0, 'alto'],
  ['R2', 4749, 39, 3.9, 'medio'],
  ['R3', 4751, 40, 4.0, 'alto'],
  ['R4', -250, 30, 3.0, 'medio'],
  ['R5', -251, 29, 2.9, 'bajo'],
  ['R6', -249, 30, 3.0, 'medio'],
  ['R7', 9750, 50, 5.0, 'alto'],
  ['R8', 9749, 49, 4.9, 'alto'],
  ['R9', 10000, 50, 5.0, 'alto'],
  ['R10', -10000, 10, 1.0, 'bajo'],
];

describe('R1-R10 limites de redondeo', () => {
  it.each(TABLE)('%s scoreBp=%i', (_id, score, tenths, decimal, bucket) => {
    const t = tenthsFromScoreBp(score);
    expect(t).toBe(tenths);
    expect(t / 10).toBe(decimal);
    expect(bucketOfTenths(t)).toBe(bucket);
  });
});

describe('R11 barrido completo', () => {
  it('coincide con la formula entera de referencia y no decrece', () => {
    let prev = -Infinity;
    for (let s = -10000; s <= 10000; s++) {
      const t = tenthsFromScoreBp(s);
      expect(t).toBe(Math.floor((2 * (30000 + 2 * s) + 1000) / 2000));
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
});

describe('R12 roundDiv', () => {
  it('casos conocidos', () => {
    expect(roundDiv(5, 2)).toBe(3);
    expect(roundDiv(-5, 2)).toBe(-3);
    expect(roundDiv(4, 2)).toBe(2);
    expect(roundDiv(-1, 3)).toBe(0);
    expect(Object.is(roundDiv(-1, 3), 0)).toBe(true);
  });
});

describe('R13 sin flotante en el codigo', () => {
  const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf-8');

  it('taste.ts y predict.ts no usan toFixed ni Math.round sobre productos por 10', () => {
    for (const f of ['taste.ts', 'predict.ts']) {
      const src = read(f);
      expect(src).not.toMatch(/toFixed/);
      expect(src).not.toMatch(/Math\.round\([^)]*\*\s*10\b/);
    }
  });

  it('solo predict() divide entre 10', () => {
    const taste = read('taste.ts');
    expect(taste).not.toMatch(/\/\s*10\s*\)/);
    const predictSrc = read('predict.ts');
    const withoutPredict = predictSrc.replace(/export function predict\([\s\S]*?\n}\n/, '');
    expect(withoutPredict).not.toMatch(/\/\s*10\s*[);]/);
    expect(predictSrc).toMatch(/\/ 10;/);
    expect(typeof predict).toBe('function');
  });
});
