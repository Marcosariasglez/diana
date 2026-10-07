import type { InitialRating } from '@/types/rating';
import { buildTasteProfile, tasteScoreBp, noiseBp } from '../taste';
import { bucketOfTenths, predict, predictTenths, tenthsFromScoreBp } from '../predict';
import { affinity } from '../affinity';
import { ACCION, COMEDIA, DRAMA, ROMANCE, SCIFI, lookupFrom, synthEntry, synthMovie, zeroNoise } from './helpers';

// Catalogo sintetico del perfil P1 (7.3).
const m1 = synthMovie(1, [DRAMA]);
const m2 = synthMovie(2, [DRAMA, ROMANCE]);
const m3 = synthMovie(3, [COMEDIA]);
const m4 = synthMovie(4, [ACCION]);
const sf = synthMovie(5, [SCIFI]);
const hDrama = synthMovie(6, [DRAMA]);
const hComedia = synthMovie(7, [COMEDIA]);
const lookup = lookupFrom([m1, m2, m3, m4, sf, hDrama, hComedia]);

const P1_RATINGS: Record<number, InitialRating> = { 1: 'like', 2: 'like', 3: 'skip', 4: 'unseen' };
const P1 = buildTasteProfile('user-me', P1_RATINGS, [], lookup);

const target = (ids: number[]) => synthMovie(100, ids);
const KEY = 'movie:100';

function check(
  profile: typeof P1,
  genres: number[],
  scoreBp: number,
  tenths: number,
  decimal: number,
  bucket: string,
) {
  const media = target(genres);
  expect(tasteScoreBp(profile, media, KEY, zeroNoise)).toBe(scoreBp);
  expect(predictTenths(profile, media, KEY, zeroNoise)).toBe(tenths);
  expect(tenths / 10).toBe(decimal);
  expect(bucketOfTenths(predictTenths(profile, media, KEY, zeroNoise))).toBe(bucket);
  expect(affinity(profile, media, KEY, zeroNoise)).toBe(bucket);
}

describe('perfil P1', () => {
  it('pesos por genero', () => {
    expect(P1.weightBp).toEqual({ [DRAMA]: 10000, [ROMANCE]: 5000, [COMEDIA]: -2500, [ACCION]: 0 });
  });
});

describe('T1-T15', () => {
  it('T1', () => check(P1, [DRAMA], 10000, 50, 5.0, 'alto'));
  it('T2', () => check(P1, [DRAMA, ROMANCE], 7500, 45, 4.5, 'alto'));
  it('T3', () => check(P1, [DRAMA, SCIFI], 5000, 40, 4.0, 'alto'));
  it('T4', () => check(P1, [DRAMA, COMEDIA, ROMANCE], 4167, 38, 3.8, 'medio'));
  it('T5', () => check(P1, [DRAMA, COMEDIA], 3750, 38, 3.8, 'medio'));
  it('T6', () => check(P1, [SCIFI], 0, 30, 3.0, 'medio'));
  it('T7', () => check(P1, [ROMANCE, COMEDIA, SCIFI], 833, 32, 3.2, 'medio'));
  it('T8', () => check(P1, [COMEDIA], -2500, 25, 2.5, 'bajo'));
  it('T9', () => check(P1, [ACCION], 0, 30, 3.0, 'medio'));
  it('T10', () => {
    const p = buildTasteProfile('user-me', P1_RATINGS, [synthEntry(5, 5)], lookup);
    expect(p.weightBp[SCIFI]).toBe(10000);
    check(p, [SCIFI], 10000, 50, 5.0, 'alto');
  });
  it('T11', () => {
    const p = buildTasteProfile('user-me', P1_RATINGS, [synthEntry(6, 1)], lookup);
    check(p, [DRAMA], 0, 30, 3.0, 'medio');
  });
  it('T12', () => {
    const p = buildTasteProfile('user-me', P1_RATINGS, [synthEntry(7, 3)], lookup);
    check(p, [COMEDIA], -2500, 25, 2.5, 'bajo');
  });
  it('T13', () => {
    const empty = buildTasteProfile('user-me', {}, [], lookup);
    check(empty, [DRAMA, COMEDIA], 0, 30, 3.0, 'medio');
    check(empty, [], 0, 30, 3.0, 'medio');
  });
  it('T14', () => {
    const media = target([DRAMA]);
    expect(tasteScoreBp(P1, media, KEY, () => 1500)).toBe(10000);
    expect(predictTenths(P1, media, KEY, () => 1500)).toBe(50);
  });
  it('T15', () => {
    const neg = buildTasteProfile('user-me', { 3: 'skip' }, [], lookup);
    expect(neg.weightBp[COMEDIA]).toBe(-10000);
    const media = target([COMEDIA]);
    expect(tasteScoreBp(neg, media, KEY, () => -1500)).toBe(-10000);
    expect(predictTenths(neg, media, KEY, () => -1500)).toBe(10);
    expect(affinity(neg, media, KEY, () => -1500)).toBe('bajo');
  });
});

describe('ruido y estabilidad', () => {
  it('noiseBp es determinista y esta en rango', () => {
    const first = noiseBp('user-me', 'movie:1');
    for (let i = 0; i < 100; i++) {
      const v = noiseBp('user-me', 'movie:1');
      expect(v).toBe(first);
      expect(v).toBeGreaterThanOrEqual(-1500);
      expect(v).toBeLessThanOrEqual(1500);
    }
  });
  it('usuarios distintos difieren en al menos una de 20 claves', () => {
    let differs = 0;
    for (let i = 1; i <= 20; i++) {
      if (noiseBp('user-me', `movie:${i}`) !== noiseBp('user-maria', `movie:${i}`)) differs++;
    }
    expect(differs).toBeGreaterThanOrEqual(1);
  });
  it('predict es estable y tiene un decimal', () => {
    const media = target([DRAMA, ROMANCE]);
    const a = predict(P1, media, KEY);
    expect(predict(P1, media, KEY)).toBe(a);
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(5);
    expect(Number.isInteger(a * 10)).toBe(true);
  });
  it('tenthsFromScoreBp(0) es 30', () => {
    expect(tenthsFromScoreBp(0)).toBe(30);
  });
});
