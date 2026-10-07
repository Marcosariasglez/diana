import { useCallback, useEffect, useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { searchRepository } from '@/services';
import type { SearchKind, SearchResult } from '@/types/search';

export const SEARCH_DEBOUNCE_MS = 300;

export type DailyLogSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DailyLogSearch {
  status: DailyLogSearchStatus;
  results: SearchResult[];
  retry: () => void;
}

interface Snapshot {
  /** Peticion a la que corresponde (consulta, filtro y reintento). */
  forKey: string;
  status: 'loading' | 'ready' | 'error';
  results: SearchResult[];
}

/**
 * Busqueda del Diario rapido: debounce de 300 ms y descarte de respuestas obsoletas
 * (cada efecto lleva su propio flag `cancelled`, que el cleanup activa al cambiar la
 * consulta, el filtro o al desmontar).
 */
export function useDailyLogSearch(query: string, kind: SearchKind): DailyLogSearch {
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, SEARCH_DEBOUNCE_MS);
  const [snapshot, setSnapshot] = useState<Snapshot>({ forKey: '', status: 'ready', results: [] });
  const [nonce, setNonce] = useState(0);
  const requestKey = `${debounced}|${kind}|${nonce}`;

  useEffect(() => {
    if (debounced === '') return;
    let cancelled = false;
    setSnapshot({ forKey: requestKey, status: 'loading', results: [] });
    searchRepository
      .search({ query: debounced, kind })
      .then(({ results }) => {
        if (!cancelled) setSnapshot({ forKey: requestKey, status: 'ready', results });
      })
      .catch(() => {
        if (!cancelled) setSnapshot({ forKey: requestKey, status: 'error', results: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, kind, requestKey]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  // Sin texto no hay nada que mostrar, aunque el debounce aun no lo haya notado.
  if (trimmed === '') return { status: 'idle', results: [], retry };
  // Texto nuevo todavia dentro del debounce: se muestra la carga, no resultados viejos.
  if (trimmed !== debounced) return { status: 'loading', results: [], retry };
  if (snapshot.forKey !== requestKey) return { status: 'loading', results: [], retry };
  return { status: snapshot.status, results: snapshot.results, retry };
}

export function resultKey(r: SearchResult): string {
  return `${r.kind}:${r.mediaId}:${r.seasonNumber ?? ''}:${r.episodeNumber ?? ''}`;
}
