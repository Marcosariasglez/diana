// D2-2.5 (VERTICE-PLAN-2): arranque en frío — con 0 valoraciones el mazo inicial
// usa títulos populares y diversos, y cuando se dan las plataformas del usuario
// se construye «populares en tus plataformas» (con complemento del resto del
// catálogo si no hay suficientes disponibles).
import { ONBOARDING_COUNT } from '@/constants/onboarding';
import { FIXTURE_CATALOG, FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import { getOnboardingDeckMovies } from '../onboardingDeck';

const PLATFORMS = ['netflix', 'prime-video', 'max', 'disney-plus'];

describe('mazo del onboarding con plataformas (D2-2.5 arranque en frio)', () => {
  it('con todas las plataformas del perfil, el mazo es solo de esas (y popular: 20 unicas)', () => {
    const deck = getOnboardingDeckMovies(ONBOARDING_COUNT, FIXTURE_CATALOG, PLATFORMS);
    expect(deck).toHaveLength(20);
    expect(new Set(deck.map((m) => m.id)).size).toBe(20);
    expect(deck.every((m) => m.platforms.some((p) => PLATFORMS.includes(p)))).toBe(true);
  });

  it('disney-plus sola (13 en el fixture < 20) completa el mazo con el resto del catalogo', () => {
    const inDp = FIXTURE_MOVIES.filter((m) => m.platforms.includes('disney-plus')).length;
    expect(inDp).toBe(13); // el fixture tiene 13 peliculas en disney-plus
    const deck = getOnboardingDeckMovies(ONBOARDING_COUNT, FIXTURE_CATALOG, ['disney-plus']);
    expect(deck).toHaveLength(20);
    const dpCount = deck.filter((m) => m.platforms.includes('disney-plus')).length;
    expect(dpCount).toBeGreaterThanOrEqual(1);
    expect(deck.length - dpCount).toBeGreaterThanOrEqual(20 - inDp); // complemento
  });

  it('con plataformas desconocidas (0 disponibles) cae al mazo completo (Aftersun primero)', () => {
    const deck = getOnboardingDeckMovies(ONBOARDING_COUNT, FIXTURE_CATALOG, ['no-existe']);
    expect(deck).toHaveLength(20);
    expect(deck[0].title).toBe('Aftersun');
    expect(deck.every((m) => FIXTURE_MOVIES.some((x) => x.id === m.id))).toBe(true);
  });

  it('con plataformas vacias es igual que sin plataformas (contrato O2 intacto)', () => {
    expect(getOnboardingDeckMovies(20, FIXTURE_CATALOG, []).map((m) => m.id)).toEqual(
      getOnboardingDeckMovies(20, FIXTURE_CATALOG).map((m) => m.id),
    );
  });

  it('con plataformas es determinista', () => {
    const a = getOnboardingDeckMovies(20, FIXTURE_CATALOG, ['netflix']);
    const b = getOnboardingDeckMovies(20, FIXTURE_CATALOG, ['netflix']);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it('mantiene la diversidad de generos principales aunque se filtre por plataforma', () => {
    const deck = getOnboardingDeckMovies(ONBOARDING_COUNT, FIXTURE_CATALOG, PLATFORMS);
    expect(new Set(deck.map((m) => m.genres[0]?.id ?? 0)).size).toBeGreaterThanOrEqual(8);
  });
});
