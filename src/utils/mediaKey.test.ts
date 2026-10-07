import { buildMediaKey } from './mediaKey';

describe('buildMediaKey', () => {
  it('pelicula', () => expect(buildMediaKey({ mediaType: 'movie', mediaId: 42 })).toBe('movie:42'));
  it('serie completa', () => expect(buildMediaKey({ mediaType: 'tv', mediaId: 7 })).toBe('tv:7'));
  it('temporada', () => expect(buildMediaKey({ mediaType: 'tv', mediaId: 7, season: 1 })).toBe('tv:7:s1'));
  it('capitulo', () =>
    expect(buildMediaKey({ mediaType: 'tv', mediaId: 7, season: 1, episode: 3 })).toBe('tv:7:s1:e3'));
  it('episode sin season lanza error', () => {
    expect(() => buildMediaKey({ mediaType: 'tv', mediaId: 7, episode: 3 })).toThrow();
  });
  it('pelicula y serie con el mismo id tienen claves distintas', () => {
    expect(buildMediaKey({ mediaType: 'movie', mediaId: 1 })).not.toBe(buildMediaKey({ mediaType: 'tv', mediaId: 1 }));
  });
});
