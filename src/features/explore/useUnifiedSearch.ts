// Rediseño Explorar (plan P4): datos del buscador unificado.
//
// Recibe los filtros (los posee la pantalla) y devuelve la lista paginada:
//   · sin texto buscable → `browse` (todos los filtros van al servidor);
//   · con texto (2+ letras, tras 300 ms) → `search` con los mismos filtros.
// Descarta respuestas de peticiones anteriores (reqId), conserva lo cargado si
// falla una página posterior y, opcionalmente, cuenta el total para el botón
// «Ver N títulos» del panel de filtros.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import type { Media } from '@/types/media';
import { searchText, toCountParams, toScope, type ExploreFilters } from './exploreFilters';

/** Múltiplo de 3 y de 2: llena filas completas en la rejilla de 3 y 4 columnas. */
export const EXPLORE_PAGE_SIZE = 30;
const QUERY_DEBOUNCE_MS = 300;
/** Espera tras el último cambio de filtros antes de contar (el usuario está tocando chips). */
const COUNT_DELAY_MS = 250;

export type ExploreStatus = 'loading' | 'ready' | 'error';

export interface UnifiedSearch {
  items: Media[];
  /** 'loading' solo en la primera página de una consulta; 'error' si esa primera página falla. */
  status: ExploreStatus;
  hasMore: boolean;
  loadingMore: boolean;
  /** Falló una página posterior a la primera: lo cargado se conserva. */
  pageError: boolean;
  /** Nº total de títulos con estos filtros; null mientras se calcula, si falla o si no se pidió. */
  total: number | null;
  loadMore: () => void;
  retryMore: () => void;
  reload: () => void;
}

const keyOf = (m: Media) => `${m.media_type}-${m.id}`;

function merge(current: Media[], incoming: Media[]): Media[] {
  const seen = new Set(current.map(keyOf));
  return [...current, ...incoming.filter((m) => !seen.has(keyOf(m)))];
}

export function useUnifiedSearch(filters: ExploreFilters, options: { countTotal?: boolean } = {}): UnifiedSearch {
  const countTotal = options.countTotal ?? false;
  const debouncedQuery = useDebounce(filters.query, QUERY_DEBOUNCE_MS);

  // Filtros efectivos: el texto va con retraso, el resto se aplica al instante.
  // `key` identifica la consulta: si no cambia, no se recarga.
  const effective: ExploreFilters = { ...filters, query: debouncedQuery };
  const text = searchText(effective);
  const scope = toScope(effective);
  const key = JSON.stringify([text, scope]);
  const query = useMemo(() => ({ text, scope, count: toCountParams(effective) }), [key]);

  const [items, setItems] = useState<Media[]>([]);
  const [status, setStatus] = useState<ExploreStatus>('loading');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  const cursor = useRef<number | null>(null);
  const busy = useRef(false);
  const reqId = useRef(0);

  const fetchPage = useCallback(
    async (from: number, first: boolean) => {
      const id = ++reqId.current;
      busy.current = true;
      try {
        const source = activeCatalogSource;
        const res = query.text
          ? await source.search({ ...query.scope, query: query.text, cursor: from, limit: EXPLORE_PAGE_SIZE })
          : await source.browse({ ...query.scope, cursor: from, limit: EXPLORE_PAGE_SIZE });
        if (id !== reqId.current) return;
        cursor.current = res.nextCursor;
        setItems((cur) => merge(first ? [] : cur, res.items));
        setHasMore(res.hasMore);
        setPageError(false);
        setStatus('ready');
      } catch {
        if (id !== reqId.current) return;
        if (first) setStatus('error');
        else setPageError(true);
      } finally {
        if (id === reqId.current) {
          busy.current = false;
          setLoadingMore(false);
        }
      }
    },
    [query],
  );

  const loadFirst = useCallback(() => {
    cursor.current = null;
    setItems([]);
    setHasMore(false);
    setPageError(false);
    setLoadingMore(false);
    setStatus('loading');
    void fetchPage(0, true);
  }, [fetchPage]);

  // Primera página: al montar y cada vez que cambia la consulta. Al desmontar,
  // las respuestas en vuelo se descartan.
  useEffect(() => {
    loadFirst();
    return () => {
      reqId.current++;
    };
  }, [loadFirst]);

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore || status !== 'ready' || cursor.current === null) return;
    setLoadingMore(true);
    void fetchPage(cursor.current, false);
  }, [fetchPage, hasMore, status]);

  const retryMore = useCallback(() => {
    setPageError(false);
    loadMore();
  }, [loadMore]);

  // Recuento para «Ver N títulos»: solo si se pide, con un breve retardo.
  useEffect(() => {
    if (!countTotal) return;
    setTotal(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      activeCatalogSource
        .count(query.count)
        .then((n) => {
          if (!cancelled) setTotal(n);
        })
        .catch(() => {
          if (!cancelled) setTotal(null);
        });
    }, COUNT_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [countTotal, query]);

  return { items, status, hasMore, loadingMore, pageError, total, loadMore, retryMore, reload: loadFirst };
}
