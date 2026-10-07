import { formatRating, formatRuntime, yearOf } from './format';
import { normalizeTitle } from './normalizeTitle';

describe('formatRating', () => {
  it('formatea con coma decimal', () => {
    expect(formatRating(4.5)).toBe('4,5');
    expect(formatRating(4)).toBe('4,0');
    expect(formatRating(0.5)).toBe('0,5');
    expect(formatRating(3.8)).toBe('3,8');
  });
  it('null devuelve raya larga', () => {
    expect(formatRating(null)).toBe('—');
  });
});

describe('formatRuntime y yearOf', () => {
  it('formatRuntime', () => {
    expect(formatRuntime(106)).toBe('1h 46m');
    expect(formatRuntime(101)).toBe('1h 41m');
    expect(formatRuntime(45)).toBe('45m');
  });
  it('yearOf', () => expect(yearOf('2023-06-02')).toBe(2023));
});

describe('normalizeTitle', () => {
  it('quita tildes, puntuacion y mayusculas', () => {
    expect(normalizeTitle('Amélie')).toBe('amelie');
    expect(normalizeTitle("Won't You  Be My Neighbor?")).toBe('won t you be my neighbor');
  });
});
