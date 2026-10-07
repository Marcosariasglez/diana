import { ONBOARDING_COUNT, ONBOARDING_MAX_PER_MAIN_GENRE, ONBOARDING_MIN_GENRES } from '@/constants/onboarding';
import { getOnboardingDeckMovies } from '../onboardingDeck';

describe('mazo del onboarding', () => {
  const deck = getOnboardingDeckMovies(ONBOARDING_COUNT);
  const main = (i: number) => deck[i].genres[0].id;

  it('tiene 20 peliculas unicas', () => {
    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((m) => m.id)).size).toBe(20);
    expect(deck.every((m) => m.media_type === 'movie')).toBe(true);
  });

  it('cubre al menos 8 generos principales', () => {
    expect(new Set(deck.map((m) => m.genres[0].id)).size).toBeGreaterThanOrEqual(ONBOARDING_MIN_GENRES);
  });

  it('no mas de 4 titulos por genero principal', () => {
    const count = new Map<number, number>();
    for (const m of deck) count.set(m.genres[0].id, (count.get(m.genres[0].id) ?? 0) + 1);
    for (const n of count.values()) expect(n).toBeLessThanOrEqual(ONBOARDING_MAX_PER_MAIN_GENRE);
  });

  it('Aftersun va primero', () => {
    expect(deck[0].title).toBe('Aftersun');
  });

  it('es determinista', () => {
    expect(getOnboardingDeckMovies(20).map((m) => m.id)).toEqual(deck.map((m) => m.id));
  });

  it('dos cartas consecutivas no comparten genero principal', () => {
    for (let i = 1; i < deck.length; i++) expect(main(i)).not.toBe(main(i - 1));
  });

  it('respeta un count menor', () => {
    expect(getOnboardingDeckMovies(5)).toHaveLength(5);
  });
});
