import { FAKE_USERS } from '../fakeUsers';
import { CATALOG, getMedia } from '../catalog';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { buildSeenKeys } from '@/store/seenKeys';
import { FAKE_HISTORY } from '../history';

describe('FAKE_USERS', () => {
  it('son los cinco amigos esperados y no incluyen al usuario actual', () => {
    expect(FAKE_USERS.map((u) => u.name)).toEqual(['María', 'Carlos', 'Ana', 'Lucas', 'Sofía']);
    expect(FAKE_USERS.some((u) => u.userId === 'user-me')).toBe(false);
    for (const u of FAKE_USERS) expect(u.initial).toBe(u.name[0]);
  });

  it.each(FAKE_USERS.map((u) => [u.name, u] as const))('%s cumple las reglas de datos', (_n, user) => {
    const values = Object.values(user.initialRatings);
    expect(values.length).toBeGreaterThanOrEqual(12);
    expect(values.filter((v) => v === 'like').length).toBeGreaterThanOrEqual(5);
    expect(values.filter((v) => v === 'skip').length).toBeGreaterThanOrEqual(3);
    expect(values.filter((v) => v === 'unseen').length).toBeGreaterThanOrEqual(2);
    for (const id of Object.keys(user.initialRatings)) {
      expect(getMedia('movie', Number(id))).toBeDefined();
    }
  });

  it('tienen perfiles de gusto distintos', () => {
    const profiles = FAKE_USERS.map((u) => JSON.stringify(buildTasteProfile(u.userId, u.initialRatings, []).weightBp));
    expect(new Set(profiles).size).toBe(FAKE_USERS.length);
  });

  it('like y skip forman los vistos de cada amigo', () => {
    for (const u of FAKE_USERS) {
      const seen = buildSeenKeys({ initialRatings: u.initialRatings, entries: FAKE_HISTORY[u.userId] ?? [], watched: [] });
      for (const [id, v] of Object.entries(u.initialRatings)) {
        expect(seen.has(`movie:${id}`)).toBe(v !== 'unseen');
      }
    }
  });
});

describe('catalogo mock', () => {
  const movies = CATALOG.filter((m) => m.media_type === 'movie');

  it('tiene al menos 60 titulos con ids secuenciales unicos', () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(60);
    const ids = CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id, i) => expect(id).toBe(i + 1));
  });

  it('incluye los titulos de los wireframes', () => {
    const find = (t: string) => movies.find((m) => m.media_type === 'movie' && m.title === t);
    expect(find('Aftersun')).toMatchObject({ runtime: 101, release_date: expect.stringMatching(/^2022/) });
    expect(find('Past Lives')).toMatchObject({ runtime: 106, platforms: expect.arrayContaining(['max']) });
    for (const t of ['Burning', 'Perfect Days', 'Columbus', 'Parásitos', 'Fall']) expect(find(t)).toBeDefined();
    expect(find('Parásitos')?.alt_titles).toContain('Parasite');
    const fallout = CATALOG.find((m) => m.media_type === 'tv' && m.name === 'Fallout');
    expect(fallout?.media_type === 'tv' && fallout.seasons[0].episodes.length).toBeGreaterThanOrEqual(4);
    expect(fallout?.media_type === 'tv' && fallout.seasons[0].episodes[2].episode_number).toBe(3);
  });

  it('al menos 10 generos principales con 2 peliculas cada uno', () => {
    const count = new Map<number, number>();
    for (const m of movies) count.set(m.genres[0].id, (count.get(m.genres[0].id) ?? 0) + 1);
    expect(count.size).toBeGreaterThanOrEqual(10);
    for (const n of count.values()) expect(n).toBeGreaterThanOrEqual(2);
  });

  it('tiene variedad de duracion, epoca, plataforma, series y votos', () => {
    const rt = movies.map((m) => (m.media_type === 'movie' ? m.runtime : 0));
    expect(rt.some((r) => r < 90)).toBe(true);
    expect(rt.some((r) => r >= 90 && r <= 150)).toBe(true);
    expect(rt.some((r) => r > 150)).toBe(true);
    const year = (m: (typeof CATALOG)[number]) =>
      Number((m.media_type === 'movie' ? m.release_date : m.first_air_date).slice(0, 4));
    expect(CATALOG.some((m) => year(m) < 2000)).toBe(true);
    expect(CATALOG.some((m) => year(m) >= 2000 && year(m) <= 2019)).toBe(true);
    expect(CATALOG.some((m) => year(m) >= 2020)).toBe(true);
    for (const p of ['netflix', 'prime-video', 'max', 'disney-plus']) {
      expect(CATALOG.some((m) => m.platforms.includes(p))).toBe(true);
    }
    expect(CATALOG.some((m) => m.media_type === 'tv')).toBe(true);
    expect(CATALOG.filter((m) => m.vote_count <= 5000).length).toBeGreaterThanOrEqual(8);
    expect(CATALOG.filter((m) => m.vote_count > 10000).length).toBeGreaterThanOrEqual(8);
  });
});
