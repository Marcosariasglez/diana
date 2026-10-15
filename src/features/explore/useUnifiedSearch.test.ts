import { act, renderHook } from '@testing-library/react-native';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import type { PageResult } from '@/services/supabase/catalog/types';
import type { Media } from '@/types/media';
import { INITIAL_FILTERS, setDecade, setQuery, setType, toggleGenre, togglePlatform, type ExploreFilters } from './exploreFilters';
import { useUnifiedSearch } from './useUnifiedSearch';

jest.mock('@/services/supabase/catalog/select', () => ({
  activeCatalogSource: { browse: jest.fn(), search: jest.fn(), count: jest.fn() },
}));

const browse = activeCatalogSource.browse as jest.Mock;
const search = activeCatalogSource.search as jest.Mock;
const count = activeCatalogSource.count as jest.Mock;

const movie = (id: number) => ({ id, media_type: 'movie', title: `T${id}`, genres: [] }) as unknown as Media;
const page = (ids: number[], nextCursor: number | null): PageResult<Media> => ({
  items: ids.map(movie),
  nextCursor,
  hasMore: nextCursor !== null,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ids = (items: Media[]) => items.map((m) => m.id);

/** Deja correr las promesas pendientes (y los temporizadores simulados). */
const flush = (ms = 0) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  browse.mockReset().mockResolvedValue(page([1, 2, 3], null));
  search.mockReset().mockResolvedValue(page([9], null));
  count.mockReset().mockResolvedValue(42);
});
afterEach(() => jest.useRealTimers());

describe('useUnifiedSearch — carga inicial y filtros', () => {
  it('carga la primera página con browse y el orden por defecto', async () => {
    const first = deferred<PageResult<Media>>();
    browse.mockReturnValueOnce(first.promise);
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    expect(result.current.status).toBe('loading');
    expect(result.current.items).toEqual([]);
    await act(async () => first.resolve(page([1, 2, 3], null)));
    expect(browse).toHaveBeenCalledTimes(1);
    expect(browse).toHaveBeenCalledWith({ sort: 'popularity', cursor: 0, limit: 30 });
    expect(search).not.toHaveBeenCalled();
    expect(result.current.status).toBe('ready');
    expect(ids(result.current.items)).toEqual([1, 2, 3]);
    expect(result.current.hasMore).toBe(false);
  });

  it('traduce tipo, plataformas, géneros y década a browse (géneros al servidor)', async () => {
    let f: ExploreFilters = setType(INITIAL_FILTERS, 'tv');
    f = setDecade(toggleGenre(toggleGenre(togglePlatform(f, 'netflix'), 18), 53), 1990);
    await renderHook(() => useUnifiedSearch(f));
    await flush();
    expect(browse).toHaveBeenCalledWith({
      type: 'tv',
      platforms: ['netflix'],
      genres: [18, 53],
      decade: 1990,
      sort: 'popularity',
      cursor: 0,
      limit: 30,
    });
  });

  it('un filtro nuevo recarga desde cero sin esperar al debounce', async () => {
    const { result, rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f), { initialProps: INITIAL_FILTERS });
    await flush();
    const next = deferred<PageResult<Media>>();
    browse.mockReturnValueOnce(next.promise);
    await rerender(toggleGenre(INITIAL_FILTERS, 18));
    expect(result.current.status).toBe('loading');
    expect(result.current.items).toEqual([]);
    await act(async () => next.resolve(page([7, 8], null)));
    expect(browse).toHaveBeenLastCalledWith(expect.objectContaining({ genres: [18], cursor: 0 }));
    expect(ids(result.current.items)).toEqual([7, 8]);
  });
});

describe('useUnifiedSearch — texto', () => {
  it('con menos de 2 letras explora el catálogo en vez de buscar', async () => {
    await renderHook(() => useUnifiedSearch(setQuery(INITIAL_FILTERS, 'd')));
    await flush(400);
    expect(search).not.toHaveBeenCalled();
    expect(browse).toHaveBeenCalledTimes(1);
  });

  it('con 2+ letras busca (con los filtros) tras 300 ms de debounce', async () => {
    const { result, rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f), { initialProps: INITIAL_FILTERS });
    await flush();
    browse.mockClear();
    await rerender(toggleGenre(setQuery(INITIAL_FILTERS, 'villeneuve'), 878));
    // El filtro de género se aplica ya; el texto aún no.
    await flush(100);
    expect(search).not.toHaveBeenCalled();
    await flush(300);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({ query: 'villeneuve', genres: [878], sort: 'popularity', cursor: 0, limit: 30 });
    expect(ids(result.current.items)).toEqual([9]);
  });

  it('teclear rápido solo lanza una búsqueda (la última)', async () => {
    const { rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f), { initialProps: INITIAL_FILTERS });
    await flush();
    for (const q of ['du', 'dun', 'dune']) {
      await rerender(setQuery(INITIAL_FILTERS, q));
      await flush(100);
    }
    await flush(400);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'dune' }));
  });

  it('seguir escribiendo sin cambiar el texto efectivo no recarga', async () => {
    const { rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f), { initialProps: setQuery(INITIAL_FILTERS, 'dune') });
    await flush(400);
    expect(search).toHaveBeenCalledTimes(1);
    await rerender(setQuery(INITIAL_FILTERS, ' dune '));
    await flush(400);
    expect(search).toHaveBeenCalledTimes(1);
  });
});

describe('useUnifiedSearch — paginación', () => {
  it('loadMore pide desde nextCursor y concatena sin duplicados', async () => {
    browse.mockResolvedValueOnce(page([1, 2, 3], 30));
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await flush();
    expect(result.current.hasMore).toBe(true);
    browse.mockResolvedValueOnce(page([3, 4, 5], null));
    await act(async () => {
      result.current.loadMore();
    });
    await flush();
    expect(browse).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 30, limit: 30 }));
    expect(ids(result.current.items)).toEqual([1, 2, 3, 4, 5]);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore no hace nada sin más páginas ni mientras ya hay una petición en vuelo', async () => {
    browse.mockResolvedValueOnce(page([1], 30));
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await flush();
    const d = deferred<PageResult<Media>>();
    browse.mockReturnValueOnce(d.promise);
    await act(async () => {
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();
    });
    expect(browse).toHaveBeenCalledTimes(2);
    expect(result.current.loadingMore).toBe(true);
    await act(async () => d.resolve(page([2], null)));
    expect(result.current.loadingMore).toBe(false);
    await act(async () => {
      result.current.loadMore();
    });
    expect(browse).toHaveBeenCalledTimes(2);
  });

  it('una página de búsqueda continúa con search, no con browse', async () => {
    search.mockResolvedValueOnce(page([9], 30));
    const { result } = await renderHook(() => useUnifiedSearch(setQuery(INITIAL_FILTERS, 'dune')));
    await flush(400);
    search.mockResolvedValueOnce(page([10], null));
    await act(async () => {
      result.current.loadMore();
    });
    await flush();
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'dune', cursor: 30 }));
    expect(browse).not.toHaveBeenCalled();
    expect(ids(result.current.items)).toEqual([9, 10]);
  });
});

describe('useUnifiedSearch — respuestas obsoletas y errores', () => {
  it('descarta la respuesta de una petición anterior a un cambio de filtros', async () => {
    const slow = deferred<PageResult<Media>>();
    browse.mockReturnValueOnce(slow.promise);
    const { result, rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f), { initialProps: INITIAL_FILTERS });
    browse.mockResolvedValueOnce(page([20, 21], null));
    await rerender(toggleGenre(INITIAL_FILTERS, 35));
    await flush();
    expect(ids(result.current.items)).toEqual([20, 21]);
    await act(async () => slow.resolve(page([1, 2, 3], null)));
    expect(ids(result.current.items)).toEqual([20, 21]);
    expect(result.current.status).toBe('ready');
  });

  it('un error en la primera página da status error y reload lo recupera', async () => {
    browse.mockRejectedValueOnce(new Error('red'));
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await flush();
    expect(result.current.status).toBe('error');
    expect(result.current.items).toEqual([]);
    await act(async () => {
      result.current.reload();
    });
    await flush();
    expect(result.current.status).toBe('ready');
    expect(ids(result.current.items)).toEqual([1, 2, 3]);
  });

  it('un error al pedir más conserva lo cargado y retryMore reintenta', async () => {
    browse.mockResolvedValueOnce(page([1, 2], 30));
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await flush();
    browse.mockRejectedValueOnce(new Error('red'));
    await act(async () => {
      result.current.loadMore();
    });
    await flush();
    expect(result.current.pageError).toBe(true);
    expect(result.current.status).toBe('ready');
    expect(ids(result.current.items)).toEqual([1, 2]);
    browse.mockResolvedValueOnce(page([3], null));
    await act(async () => {
      result.current.retryMore();
    });
    await flush();
    expect(result.current.pageError).toBe(false);
    expect(ids(result.current.items)).toEqual([1, 2, 3]);
  });

  it('desmontar con una petición en vuelo no actualiza estado ni lanza', async () => {
    const slow = deferred<PageResult<Media>>();
    browse.mockReturnValueOnce(slow.promise);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await unmount();
    await act(async () => slow.resolve(page([1], null)));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('useUnifiedSearch — recuento (botón «Ver N títulos»)', () => {
  it('no cuenta si no se pide', async () => {
    await renderHook(() => useUnifiedSearch(INITIAL_FILTERS));
    await flush(1000);
    expect(count).not.toHaveBeenCalled();
  });

  it('con countTotal cuenta con los mismos filtros (sin orden ni paginación) tras un breve retardo', async () => {
    const f = toggleGenre(togglePlatform(INITIAL_FILTERS, 'max'), 18);
    const { result } = await renderHook(() => useUnifiedSearch(f, { countTotal: true }));
    expect(result.current.total).toBeNull();
    await flush(500);
    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({ platforms: ['max'], genres: [18] });
    expect(result.current.total).toBe(42);
  });

  it('con texto buscable el recuento lleva la query', async () => {
    await renderHook(() => useUnifiedSearch(setQuery(INITIAL_FILTERS, 'dune'), { countTotal: true }));
    await flush(1000);
    expect(count).toHaveBeenCalledWith({ query: 'dune' });
  });

  it('cambiar filtros vuelve a contar y descarta el recuento viejo', async () => {
    const { result, rerender } = await renderHook((f: ExploreFilters) => useUnifiedSearch(f, { countTotal: true }), {
      initialProps: INITIAL_FILTERS,
    });
    await flush(500);
    expect(result.current.total).toBe(42);
    count.mockResolvedValueOnce(7);
    await rerender(toggleGenre(INITIAL_FILTERS, 18));
    expect(result.current.total).toBeNull();
    await flush(500);
    expect(result.current.total).toBe(7);
  });

  it('si contar falla, total queda en null (el CTA dirá «Ver resultados»)', async () => {
    count.mockResolvedValueOnce(null);
    const { result } = await renderHook(() => useUnifiedSearch(INITIAL_FILTERS, { countTotal: true }));
    await flush(500);
    expect(result.current.total).toBeNull();
    count.mockRejectedValueOnce(new Error('x'));
    const again = await renderHook(() => useUnifiedSearch(toggleGenre(INITIAL_FILTERS, 18), { countTotal: true }));
    await flush(500);
    expect(again.result.current.total).toBeNull();
  });
});
