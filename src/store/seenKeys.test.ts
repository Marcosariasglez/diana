import { buildSeenKeys } from './seenKeys';

const empty = { initialRatings: {}, entries: [], watched: [] };

describe('buildSeenKeys', () => {
  it('S1 like cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 5: 'like' } }).has('movie:5')).toBe(true);
  });
  it('S2 skip cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 6: 'skip' } }).has('movie:6')).toBe(true);
  });
  it('S3 unseen no cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 7: 'unseen' } }).has('movie:7')).toBe(false);
  });
  it('S4 las entradas del historial cuentan', () => {
    expect(buildSeenKeys({ ...empty, entries: [{ key: 'tv:9:s1:e3' }] }).has('tv:9:s1:e3')).toBe(true);
  });
  it('S5 watched cuenta', () => {
    expect(buildSeenKeys({ ...empty, watched: ['movie:11'] }).has('movie:11')).toBe(true);
  });
  it('S6 las tres fuentes con clave repetida no duplican', () => {
    const seen = buildSeenKeys({
      initialRatings: { 1: 'like', 2: 'skip', 3: 'unseen' },
      entries: [{ key: 'movie:1' }, { key: 'movie:4' }],
      watched: ['movie:1', 'movie:2', 'movie:5'],
    });
    expect([...seen].sort()).toEqual(['movie:1', 'movie:2', 'movie:4', 'movie:5']);
    expect(seen.size).toBe(4);
  });
});
