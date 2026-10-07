import { act, renderHook } from '@testing-library/react-native';
import type { InitialRating, RankingContext } from '@/types/rating';
import { MOVIES, mediaKeyOf } from '@/mocks/data/catalog';
import { FAKE_USERS } from '@/mocks/data/fakeUsers';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { rankEligible } from '@/mocks/mock-ai';
import { catalogRepository } from '@/services/catalog.repository';
import { buildGroupExcludeKeys } from '@/features/room/useGroupSwipe';
import { buildSeenKeys, selectIsSeen, selectSeenKeys, useSeenKeys } from './seen';
import { selectSeenCount, useHistoryStore } from './useHistoryStore';
import { createDefaultProfile, useProfileStore } from './useProfileStore';

jest.mock('@/mocks/latency', () => ({ fakeDelay: () => Promise.resolve() }));

const empty = { initialRatings: {}, entries: [], watched: [] };
const PLATFORMS = ['netflix', 'prime-video', 'max', 'disney-plus'];

/** Perfil con senal de gusto: likes en las peliculas de otros generos. */
const tasteRatings: Record<number, InitialRating> = { 2: 'like', 3: 'like', 4: 'like', 5: 'like', 14: 'like' };

function ctxFor(initialRatings: Record<number, InitialRating>): RankingContext {
  return {
    userId: 'user-me',
    taste: buildTasteProfile('user-me', initialRatings, []),
    seenKeys: buildSeenKeys({ ...empty, initialRatings }),
  };
}

function allCategoryKeys(items: { media: { id: number; media_type: string } }[]): Set<string> {
  return new Set(items.map((i) => `${i.media.media_type}:${i.media.id}`));
}

async function allItems(category: 'hidden-gems' | 'recommendations', ctx: RankingContext) {
  const out: { media: { id: number; media_type: string } }[] = [];
  for (let page = 0; page < 20; page++) {
    const r = await catalogRepository.getCategoryItems(category, PLATFORMS, ctx, page);
    out.push(...r.items);
    if (!r.hasMore) break;
  }
  return out;
}

describe('vistos (S1-S12)', () => {
  it('S1 like cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 5: 'like' } }).has('movie:5')).toBe(true);
  });
  it('S2 skip cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 6: 'skip' } }).has('movie:6')).toBe(true);
  });
  it('S3 unseen no cuenta como visto', () => {
    expect(buildSeenKeys({ ...empty, initialRatings: { 7: 'unseen' } }).has('movie:7')).toBe(false);
  });
  it('S4 entradas del historial', () => {
    expect(buildSeenKeys({ ...empty, entries: [{ key: 'tv:9:s1:e3' }] }).has('tv:9:s1:e3')).toBe(true);
  });
  it('S5 watched', () => {
    expect(buildSeenKeys({ ...empty, watched: ['movie:11'] }).has('movie:11')).toBe(true);
  });
  it('S6 las tres fuentes con clave repetida no duplican', () => {
    const seen = buildSeenKeys({
      initialRatings: { 1: 'like', 2: 'skip', 3: 'unseen' },
      entries: [{ key: 'movie:1' }, { key: 'movie:4' }],
      watched: ['movie:1', 'movie:2', 'movie:5'],
    });
    expect(seen.size).toBe(4);
    expect([...seen].sort()).toEqual(['movie:1', 'movie:2', 'movie:4', 'movie:5']);
  });

  it('S7 like en el destacado: el feed ya no lo devuelve (destacado ni categorias)', async () => {
    const base = ctxFor(tasteRatings);
    const featured = await catalogRepository.getFeatured(PLATFORMS, base);
    expect(featured).not.toBeNull();
    const target = featured!.media;
    expect(target.media_type).toBe('movie');

    const withLike = ctxFor({ ...tasteRatings, [target.id]: 'like' });
    const featured2 = await catalogRepository.getFeatured(PLATFORMS, withLike);
    expect(featured2?.media.id).not.toBe(target.id);
    const gems = await allItems('hidden-gems', withLike);
    const recs = await allItems('recommendations', withLike);
    const feed = await catalogRepository.getFeedCategories(PLATFORMS, withLike, 0);
    const keys = new Set([
      ...allCategoryKeys(gems),
      ...allCategoryKeys(recs),
      ...allCategoryKeys(feed.categories.flatMap((c) => c.media)),
    ]);
    expect(keys.has(mediaKeyOf(target))).toBe(false);
  });

  it('S8 skip con afinidad alta: no aparece en Joyas ocultas ni en Ver todo', async () => {
    const base = ctxFor(tasteRatings);
    const gems = await allItems('hidden-gems', base);
    expect(gems.length).toBeGreaterThan(0);
    const target = gems.find((g) => g.media.media_type === 'movie');
    expect(target).toBeDefined();

    const withSkip = ctxFor({ ...tasteRatings, [target!.media.id]: 'skip' });
    const key = `movie:${target!.media.id}`;
    expect(allCategoryKeys(await allItems('hidden-gems', withSkip)).has(key)).toBe(false);
    expect(allCategoryKeys(await allItems('recommendations', withSkip)).has(key)).toBe(false);
  });

  it('S9 unseen con afinidad alta: si puede aparecer en el feed', async () => {
    const base = ctxFor(tasteRatings);
    const target = rankEligible(PLATFORMS, base).find((r) => r.media.media_type === 'movie' && r.bucket === 'alto');
    expect(target).toBeDefined();
    const withUnseen = ctxFor({ ...tasteRatings, [target!.media.id]: 'unseen' });
    expect(withUnseen.seenKeys.has(target!.key)).toBe(false);
    const eligible = rankEligible(PLATFORMS, withUnseen);
    expect(eligible.some((r) => r.key === target!.key)).toBe(true);
    const recs = await allItems('recommendations', withUnseen);
    const featured = await catalogRepository.getFeatured(PLATFORMS, withUnseen);
    const present = allCategoryKeys(recs).has(target!.key) || (featured ? mediaKeyOf(featured.media) === target!.key : false);
    expect(present).toBe(true);
  });

  it('S10 getMoodResults no devuelve un titulo like que encaja con todas las respuestas', async () => {
    const input = { answers: {}, complexity: 'intermedio' as const, platforms: PLATFORMS };
    const base = ctxFor(tasteRatings);
    const first = await catalogRepository.getMoodResults(input, base);
    expect(first.length).toBeGreaterThan(0);
    const target = first.find((r) => r.media.media_type === 'movie')!;
    const withLike = ctxFor({ ...tasteRatings, [target.media.id]: 'like' });
    const after = await catalogRepository.getMoodResults(input, withLike);
    expect(after.some((r) => r.media.id === target.media.id && r.media.media_type === 'movie')).toBe(false);
  });

  it('S11 getGroupDeck excluye un titulo like solo del amigo Carlos (union de miembros)', async () => {
    const carlos = FAKE_USERS.find((u) => u.userId === 'user-carlos')!;
    const others = FAKE_USERS.filter((u) => u.userId !== carlos.userId);
    const onlyCarlos = Object.keys(carlos.initialRatings)
      .map(Number)
      .filter((id) => carlos.initialRatings[id] === 'like')
      .find(
        (id) =>
          MOVIES.some((m) => m.id === id) &&
          others.every((o) => o.initialRatings[id] !== 'like' && o.initialRatings[id] !== 'skip'),
      );
    expect(onlyCarlos).toBeDefined();
    const key = `movie:${onlyCarlos}`;
    const filters = { answers: {}, fallbackPlatforms: [] };

    const withoutCarlos = buildGroupExcludeKeys([{ userId: 'user-maria' }], new Set());
    const baseline = await catalogRepository.getGroupDeck({ excludeKeys: withoutCarlos, filters, count: 100 });
    expect(baseline.some((m) => mediaKeyOf(m) === key)).toBe(true);

    const union = buildGroupExcludeKeys([{ userId: 'user-maria' }, { userId: carlos.userId }], new Set());
    const deck = await catalogRepository.getGroupDeck({ excludeKeys: union, filters, count: 100 });
    expect(deck.some((m) => mediaKeyOf(m) === key)).toBe(false);
  });

  it('S12 VISTAS con solo initialRatings (20 respuestas) y sin entradas es 0', () => {
    const initialRatings: Record<number, InitialRating> = {};
    for (let i = 1; i <= 20; i++) initialRatings[i] = i % 2 ? 'like' : 'skip';
    expect(buildSeenKeys({ ...empty, initialRatings }).size).toBe(20);
    expect(selectSeenCount({ entries: [], watched: [] })).toBe(0);
  });
});

describe('selectores y hook de vistos', () => {
  beforeEach(() => {
    useProfileStore.setState({ profile: createDefaultProfile() });
    useHistoryStore.setState({ entries: [], watched: [] });
  });

  it('selectSeenKeys y selectIsSeen leen los dos stores', () => {
    useProfileStore.setState({ profile: { ...createDefaultProfile(), initialRatings: { 5: 'like', 7: 'unseen' } } });
    useHistoryStore.setState({ watched: ['movie:11'] });
    const p = useProfileStore.getState();
    const h = useHistoryStore.getState();
    expect(selectSeenKeys(p, h).has('movie:5')).toBe(true);
    expect(selectIsSeen(p, h, 'movie:11')).toBe(true);
    expect(selectIsSeen(p, h, 'movie:7')).toBe(false);
  });

  it('useSeenKeys esta memoizado y se actualiza al cambiar el historial', async () => {
    const { result, rerender } = await renderHook(() => useSeenKeys());
    const first = result.current;
    await rerender({});
    expect(result.current).toBe(first);
    await act(async () => {
      useHistoryStore.setState({ watched: ['movie:3'] });
    });
    expect(result.current).not.toBe(first);
    expect(result.current.has('movie:3')).toBe(true);
  });
});
