import { resolveSeeAll } from './seeAll';

describe('resolveSeeAll', () => {
  it('las categorías clásicas siguen siendo legacy', () => {
    expect(resolveSeeAll('hidden-gems')).toMatchObject({ kind: 'legacy', id: 'hidden-gems', title: 'Joyas ocultas' });
    expect(resolveSeeAll('recommendations')).toMatchObject({ kind: 'legacy', id: 'recommendations' });
  });

  it('popular, top-rated y tv salen del catálogo de filas', () => {
    for (const id of ['popular', 'top-rated', 'tv']) {
      const t = resolveSeeAll(id);
      expect(t?.kind).toBe('row');
    }
  });

  it('genre-18 usa el nombre del género', () => {
    const t = resolveSeeAll('genre-18');
    expect(t).toMatchObject({ kind: 'row', title: 'Explora: Drama' });
    expect(t?.kind === 'row' && t.def.params.genre).toBe(18);
  });

  it('decade-1990 filtra por década', () => {
    const t = resolveSeeAll('decade-1990');
    expect(t?.kind === 'row' && t.def.params.decade).toBe(1990);
    expect(t?.title).toBe('Cine de los 90');
  });

  it('ids desconocidos o mal formados dan null', () => {
    for (const id of [undefined, '', 'nada', 'genre-abc', 'genre-999999', 'decade-1995', 'decade-3000']) {
      expect(resolveSeeAll(id)).toBeNull();
    }
  });
});
