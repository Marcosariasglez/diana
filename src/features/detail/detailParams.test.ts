import { parseDetailParams, selectionRef, valoringLabel } from './detailParams';

describe('detailParams', () => {
  it('normaliza id, tipo, temporada y capitulo', () => {
    expect(parseDetailParams({ id: '8', type: 'tv', season: '1', episode: '3' })).toEqual({
      id: 8,
      type: 'tv',
      season: 1,
      episode: 3,
    });
  });
  it('ignora season/episode en peliculas y episode sin season', () => {
    expect(parseDetailParams({ id: '1', type: 'movie', season: '1' }).season).toBeNull();
    expect(parseDetailParams({ id: '8', type: 'tv', episode: '2' }).episode).toBeNull();
  });
  it('id invalido da null', () => {
    expect(parseDetailParams({ id: 'abc' }).id).toBeNull();
    expect(parseDetailParams({}).id).toBeNull();
  });
  it('etiqueta Valorando y referencia', () => {
    expect(valoringLabel(null, null)).toBe('Serie completa');
    expect(valoringLabel(1, null)).toBe('Temporada 1');
    expect(valoringLabel(1, 3)).toBe('Temporada 1 · Capítulo 3');
    expect(selectionRef('tv', 8, 1, 3)).toEqual({ mediaType: 'tv', mediaId: 8, season: 1, episode: 3 });
    expect(selectionRef('movie', 5, null, null)).toEqual({ mediaType: 'movie', mediaId: 5 });
  });
});
