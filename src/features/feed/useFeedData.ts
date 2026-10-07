import { useCallback, useEffect, useState } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';

/** Ultimos datos de gusto con los que se cargo el feed; sobrevive al desmontaje de Inicio. */
let lastTasteInputs: unknown[] | null = null;

/** Datos del feed "Para ti" (Inicio): carga inicial, filtro global de plataformas y paginacion. */
export function useFeedData() {
  const featured = useFeedStore((s) => s.featured);
  const categories = useFeedStore((s) => s.categories);
  const status = useFeedStore((s) => s.status);
  const hasMore = useFeedStore((s) => s.hasMore);
  const platforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const initialRatings = useProfileStore((s) => s.profile.initialRatings);
  const hasOnboarded = useProfileStore((s) => s.hasOnboarded);
  const entries = useHistoryStore((s) => s.entries);
  const watched = useHistoryStore((s) => s.watched);
  const [loadingMore, setLoadingMore] = useState(false);

  // El feed depende del gusto y de lo visto (6.1): si cambian, se descarta lo cargado.
  useEffect(() => {
    const next = [initialRatings, hasOnboarded, entries, watched];
    const prev = lastTasteInputs;
    lastTasteInputs = next;
    if (prev && prev.some((v, i) => v !== next[i])) useFeedStore.getState().reset();
  }, [initialRatings, hasOnboarded, entries, watched]);

  // Carga (o recarga tras un reset) cuando el feed esta en idle y hay plataformas.
  useEffect(() => {
    if (status === 'idle' && platforms.length > 0) {
      void useFeedStore.getState().loadFirstPage();
    }
  }, [status, platforms.length]);

  /** Cambia el filtro global (persistido) y fuerza una recarga del feed. */
  const setPlatforms = useCallback((ids: string[]) => {
    useProfileStore.getState().setFavoritePlatforms(ids);
    useFeedStore.getState().reset();
    if (ids.length > 0) void useFeedStore.getState().loadFirstPage();
  }, []);

  const reload = useCallback(() => {
    useFeedStore.getState().reset();
    void useFeedStore.getState().loadFirstPage();
  }, []);

  const loadMore = useCallback(async () => {
    const s = useFeedStore.getState();
    if (s.status !== 'ready' || !s.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      await s.loadNextPage();
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  /** Reintenta la ultima pagina que fallo sin perder lo ya cargado. */
  const retryMore = useCallback(async () => {
    useFeedStore.setState({ status: 'ready' });
    await loadMore();
  }, [loadMore]);

  const pageError = status === 'error' && categories.length > 0;
  const fatalError = status === 'error' && categories.length === 0;

  return {
    featured,
    categories,
    status,
    hasMore,
    platforms,
    loadingMore,
    pageError,
    fatalError,
    setPlatforms,
    reload,
    loadMore,
    retryMore,
  };
}
