import { INITIAL_FILTERS, setQuery, toggleGenre } from './exploreFilters';
import { applyHint, extractHints, pendingHints } from './parseQueryHints';

const kinds = (text: string) => extractHints(text).map((h) => `${h.kind}:${h.value}`);

describe('extractHints', () => {
  it('detecta género con y sin tildes, y alias', () => {
    expect(kinds('accion')).toEqual(['genre:28']);
    expect(kinds('Acción')).toEqual(['genre:28']);
    expect(kinds('thriller')).toEqual(['genre:53']);
    expect(kinds('sci-fi')).toEqual(['genre:878']);
    expect(kinds('ciencia ficcion')).toEqual(['genre:878']);
  });

  it('detecta plataformas por nombre, id y alias', () => {
    expect(kinds('netflix')).toEqual(['platform:netflix']);
    expect(kinds('prime video')).toEqual(['platform:prime-video']);
    expect(kinds('amazon')).toEqual(['platform:prime-video']);
    expect(kinds('hbo')).toEqual(['platform:max']);
    expect(kinds('disney+')).toEqual(['platform:disney-plus']);
  });

  it('detecta tipo', () => {
    expect(kinds('series')).toEqual(['type:tv']);
    expect(kinds('peliculas')).toEqual(['type:movie']);
    expect(kinds('pelis')).toEqual(['type:movie']);
  });

  it('detecta décadas: «años 90», «90s», «1994», «2010s»', () => {
    expect(kinds('años 90')).toEqual(['decade:1990']);
    expect(kinds('anos 80')).toEqual(['decade:1980']);
    expect(kinds('los 90s')).toEqual(['decade:1990']);
    expect(kinds('1994')).toEqual(['decade:1990']);
    expect(kinds('2010s')).toEqual(['decade:2010']);
    expect(kinds('década de 1980')).toEqual(['decade:1980']);
  });

  it('ignora años fuera de las décadas soportadas', () => {
    expect(kinds('1950')).toEqual([]);
    expect(kinds('años 40')).toEqual([]);
  });

  it('combina varias pistas en una frase, ordenadas por posición', () => {
    expect(kinds('thriller años 90 netflix')).toEqual(['genre:53', 'decade:1990', 'platform:netflix']);
  });

  it('solo coincide con palabras completas', () => {
    expect(kinds('maxima tension')).toEqual([]);
    expect(kinds('terrorista')).toEqual([]);
    expect(kinds('seriedad')).toEqual([]);
  });

  it('no devuelve nada para texto sin pistas', () => {
    expect(kinds('villeneuve')).toEqual([]);
    expect(kinds('')).toEqual([]);
  });

  it('devuelve posiciones sobre el texto original', () => {
    const [h] = extractHints('Mejor Acción reciente');
    expect(h.start).toBe(6);
    expect(h.end).toBe(12);
    expect('Mejor Acción reciente'.slice(h.start, h.end)).toBe('Acción');
  });
});

describe('applyHint / pendingHints', () => {
  it('aplicar una pista añade el filtro y quita la palabra del texto', () => {
    const f = setQuery(INITIAL_FILTERS, 'thriller años 90 netflix');
    const [genre] = extractHints(f.query);
    const next = applyHint(f, genre);
    expect(next.genres).toEqual([53]);
    expect(next.query).toBe('años 90 netflix');
  });

  it('aplicar todas las pistas deja el texto vacío', () => {
    let f = setQuery(INITIAL_FILTERS, 'thriller años 90 netflix');
    for (let i = 0; i < 3; i++) f = applyHint(f, extractHints(f.query)[0]);
    expect(f).toMatchObject({ query: '', genres: [53], decade: 1990, platforms: ['netflix'] });
  });

  it('no duplica un filtro que ya estaba activo', () => {
    const f = toggleGenre(setQuery(INITIAL_FILTERS, 'thriller'), 53);
    const next = applyHint(f, extractHints(f.query)[0]);
    expect(next.genres).toEqual([53]);
    expect(next.query).toBe('');
  });

  it('pendingHints oculta las pistas que ya son filtro', () => {
    const f = toggleGenre(setQuery(INITIAL_FILTERS, 'thriller netflix'), 53);
    expect(pendingHints(f).map((h) => h.value)).toEqual(['netflix']);
  });
});
