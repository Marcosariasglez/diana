import { useCallback, useEffect, useRef, useState } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import type { FeedItem, FeedRow } from '@/types/media';

/** Ultimos datos de gusto con los que se cargo el feed; sobrevive al desmontaje. */
let lastTasteInputs: unknown[] | null = null;

interface PersonalizedFeed {
  hero: FeedItem[];
  top10: FeedItem[];
  rows: FeedRow[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  platforms: string[];
  setPlatforms(ids: string[]): void;
  reload(): void;
  loadMoreRows(): Promise<void>;
  loadingMore: boolean;
  rowsError: boolean;
}

/** Datos del feed personalizado "Para ti" (Inicio): hero, Top 10, filas variadas. */
export function usePersonalizedFeed(): PersonalizedFeed {
  const hero = useFeedStore((s) => s.hero);
  const top10 = useFeedStore((s) => s.top10);
  const rows = useFeedStore((s) => s.rows);
  const status = useFeedStore((s) => s.status);
  const rowsError = useFeedStore((s) => s.rowsError);
  const platforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const initialRatings = useProfileStore((s) => s.profile.initialRatings);
  const hasOnboarded = useProfileStore((s) => s.hasOnboarded);
  const entries = useHistoryStore((s) => s.entries);
  const watched = useHistoryStore((s) => s.watched);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(true);

  // El feed depende del gusto y de lo visto: si cambian, se descarta lo cargado.
  useEffect(() => {
    const next = [initialRatings, hasOnboarded, entries, watched];
    const prev = lastTasteInputs;
    lastTasteInputs = next;
    if (prev && prev.some((v, i) => v !== next[i])) {
      useFeedStore.getState().reset();
    }
  }, [initialRatings, hasOnboarded, entries, watched]);

  // Carga (o recarga tras un reset) cuando el feed esta en idle y hay plataformas.
  useEffect(() => {
    if (status === 'idle' && platforms.length > 0) {
      void useFeedStore.getState().loadFirstPage();
    }
  }, [status, platforms.length]);

  // F9: mountedRef con reset al montar (React strict mode monta dos veces en dev)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** Cambia el filtro global (persistido) y fuerza una recarga del feed. */
  const setPlatforms = useCallback((ids: string[]) => {
    useProfileStore.getState().setFavoritePlatforms(ids);
    useFeedStore.getState().reset();
    if (ids.length > 0) {
      void useFeedStore.getState().loadFirstPage();
    }
  }, []);

  const reload = useCallback(() => {
    useFeedStore.getState().reset();
    void useFeedStore.getState().loadFirstPage();
  }, []);

  const loadMoreRows = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      await useFeedStore.getState().loadNextRows();
    } finally {
      // Solo resetea si el componente sigue montado
      if (mountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [loadingMore]);

  return {
    hero,
    top10,
    rows,
    status,
    platforms,
    loadingMore,
    rowsError,
    setPlatforms,
    reload,
    loadMoreRows,
  };
}
