import { act, renderHook } from '@testing-library/react-native';
import { searchRepository } from '@/services';
import type { SearchKind, SearchResult } from '@/types/search';
import { refOf, subtitleOf } from './resultRef';
import { useDailyLogSearch } from './useDailyLogSearch';

jest.mock('@/services', () => ({ searchRepository: { search: jest.fn() } }));

const search = searchRepository.search as jest.Mock;

const movie = (title: string, id: number): SearchResult => ({
  kind: 'movie',
  label: 'Película',
  mediaId: id,
  mediaType: 'movie',
  title,
  posterColor: '#000000',
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useDailyLogSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    search.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('sin texto esta idle y no busca', async () => {
    const { result } = await renderHook(() => useDailyLogSearch('  ', 'all'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.status).toBe('idle');
    expect(search).not.toHaveBeenCalled();
  });

  it('espera 300 ms antes de buscar y entrega los resultados', async () => {
    search.mockResolvedValue({ results: [movie('Fall', 1)], hasMore: false });
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useDailyLogSearch(q, 'all'), {
      initialProps: { q: '' },
    });
    await rerender({ q: 'Fall' });
    expect(search).not.toHaveBeenCalled();
    expect(result.current.status).toBe('loading');
    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(search).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(search).toHaveBeenCalledWith({ query: 'Fall', kind: 'all' });
    expect(result.current.status).toBe('ready');
    expect(result.current.results.map((r) => r.title)).toEqual(['Fall']);
  });

  it('descarta la respuesta obsoleta si llega despues de la nueva', async () => {
    const first = deferred<{ results: SearchResult[]; hasMore: boolean }>();
    const second = deferred<{ results: SearchResult[]; hasMore: boolean }>();
    search.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    const { result, rerender } = await renderHook(
      ({ q, k }: { q: string; k: SearchKind }) => useDailyLogSearch(q, k),
      { initialProps: { q: '', k: 'all' as SearchKind } },
    );
    await rerender({ q: 'Fal', k: 'all' });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await rerender({ q: 'Fall', k: 'all' });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(search).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve({ results: [movie('Fall', 2)], hasMore: false });
    });
    await act(async () => {
      first.resolve({ results: [movie('Falcon', 3)], hasMore: false });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.results.map((r) => r.title)).toEqual(['Fall']);
  });

  it('un fallo pasa a error y retry vuelve a pedir', async () => {
    search.mockRejectedValueOnce(new Error('x'));
    search.mockResolvedValueOnce({ results: [movie('Fall', 1)], hasMore: false });
    const { result, rerender } = await renderHook(({ q }: { q: string }) => useDailyLogSearch(q, 'all'), {
      initialProps: { q: '' },
    });
    await rerender({ q: 'Fall' });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.status).toBe('error');
    await act(async () => {
      result.current.retry();
    });
    expect(result.current.status).toBe('ready');
  });
});

describe('resultRef', () => {
  it('un capitulo incluye season y episode', () => {
    const ep: SearchResult = {
      kind: 'episode',
      label: 'Capítulo',
      mediaId: 8,
      mediaType: 'tv',
      title: 'Fallout T1 · E3',
      seriesTitle: 'Fallout',
      seasonNumber: 1,
      episodeNumber: 3,
      posterColor: '#000000',
    };
    expect(refOf(ep)).toEqual({ mediaType: 'tv', mediaId: 8, season: 1, episode: 3 });
    expect(subtitleOf(ep)).toBe('Capítulo · Temporada 1 · Episodio 3');
    expect(refOf(movie('Fall', 1))).toEqual({ mediaType: 'movie', mediaId: 1 });
    expect(subtitleOf(movie('Fall', 1))).toBe('Película');
  });
});
