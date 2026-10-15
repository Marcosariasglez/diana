import {
  INITIAL_FILTERS,
  activeCount,
  clearFilters,
  hasActiveFilters,
  removeChip,
  setDecade,
  setQuery,
  setSort,
  setType,
  toChips,
  toCountParams,
  toScope,
  searchText,
  toggleGenre,
  togglePlatform,
} from './exploreFilters';

describe('exploreFilters', () => {
  it('parte sin filtros activos', () => {
    expect(activeCount(INITIAL_FILTERS)).toBe(0);
    expect(hasActiveFilters(INITIAL_FILTERS)).toBe(false);
    expect(toChips(INITIAL_FILTERS)).toEqual([]);
  });

  it('toggleGenre y togglePlatform añaden y quitan sin mutar', () => {
    const a = toggleGenre(INITIAL_FILTERS, 18);
    expect(a.genres).toEqual([18]);
    expect(INITIAL_FILTERS.genres).toEqual([]);
    expect(toggleGenre(a, 53).genres).toEqual([18, 53]);
    expect(toggleGenre(a, 18).genres).toEqual([]);
    const p = togglePlatform(INITIAL_FILTERS, 'netflix');
    expect(p.platforms).toEqual(['netflix']);
    expect(togglePlatform(p, 'netflix').platforms).toEqual([]);
  });

  it('setDecade es single-select y pulsar la activa la quita', () => {
    const a = setDecade(INITIAL_FILTERS, 1990);
    expect(a.decade).toBe(1990);
    expect(setDecade(a, 2010).decade).toBe(2010);
    expect(setDecade(a, 1990).decade).toBeNull();
    expect(setDecade(a, null).decade).toBeNull();
  });

  it('activeCount suma tipo, plataformas, géneros y década; no cuenta texto ni orden', () => {
    let f = setQuery(INITIAL_FILTERS, 'dune');
    f = setSort(f, 'vote');
    expect(activeCount(f)).toBe(0);
    f = setType(f, 'tv');
    f = togglePlatform(togglePlatform(f, 'netflix'), 'max');
    f = toggleGenre(f, 18);
    f = setDecade(f, 2010);
    expect(activeCount(f)).toBe(5);
    expect(hasActiveFilters(f)).toBe(true);
  });

  it('toChips genera chips en orden fijo con etiquetas en español', () => {
    let f = setDecade(INITIAL_FILTERS, 2010);
    f = toggleGenre(f, 878);
    f = togglePlatform(f, 'prime-video');
    f = setType(f, 'movie');
    expect(toChips(f).map((c) => c.label)).toEqual(['Películas', 'Prime Video', 'Ciencia ficción', '2010–2019']);
    expect(new Set(toChips(f).map((c) => c.key)).size).toBe(4);
  });

  it('removeChip quita exactamente ese filtro', () => {
    let f = toggleGenre(toggleGenre(INITIAL_FILTERS, 18), 53);
    f = setDecade(togglePlatform(setType(f, 'tv'), 'netflix'), 1990);
    f = removeChip(f, { kind: 'genre', value: 18 });
    expect(f.genres).toEqual([53]);
    f = removeChip(f, { kind: 'platform', value: 'netflix' });
    expect(f.platforms).toEqual([]);
    f = removeChip(f, { kind: 'type', value: 'tv' });
    expect(f.type).toBe('all');
    f = removeChip(f, { kind: 'decade', value: 1990 });
    expect(f.decade).toBeNull();
    expect(activeCount(f)).toBe(1);
  });

  it('clearFilters conserva el texto y el resto vuelve al inicio', () => {
    const f = setSort(setDecade(toggleGenre(setQuery(INITIAL_FILTERS, 'villeneuve'), 18), 2020), 'year');
    expect(clearFilters(f)).toEqual({ ...INITIAL_FILTERS, query: 'villeneuve' });
  });
});

describe('traducción al catálogo', () => {
  it('searchText exige 2 letras y recorta espacios', () => {
    expect(searchText(setQuery(INITIAL_FILTERS, ''))).toBe('');
    expect(searchText(setQuery(INITIAL_FILTERS, 'a'))).toBe('');
    expect(searchText(setQuery(INITIAL_FILTERS, '  a '))).toBe('');
    expect(searchText(setQuery(INITIAL_FILTERS, '  du '))).toBe('du');
  });

  it('toScope omite lo que no filtra', () => {
    expect(toScope(INITIAL_FILTERS)).toEqual({ sort: 'popularity' });
  });

  it('toScope incluye tipo, plataformas, géneros, década y orden', () => {
    let f = setSort(setDecade(toggleGenre(togglePlatform(setType(INITIAL_FILTERS, 'tv'), 'max'), 18), 1990), 'vote');
    f = toggleGenre(f, 53);
    expect(toScope(f)).toEqual({ type: 'tv', platforms: ['max'], genres: [18, 53], decade: 1990, sort: 'vote' });
  });

  it('toScope copia los arrays (no comparte referencias con el estado)', () => {
    const f = toggleGenre(INITIAL_FILTERS, 18);
    expect(toScope(f).genres).not.toBe(f.genres);
  });

  it('toCountParams no lleva orden y añade el texto solo si es buscable', () => {
    const f = setSort(toggleGenre(INITIAL_FILTERS, 18), 'year');
    expect(toCountParams(f)).toEqual({ genres: [18] });
    expect(toCountParams(setQuery(f, 'dune'))).toEqual({ genres: [18], query: 'dune' });
    expect(toCountParams(setQuery(f, 'd'))).toEqual({ genres: [18] });
  });
});
