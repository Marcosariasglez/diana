import { useMemo } from 'react';
import type { RankingContext, TasteProfile } from '@/types/rating';
import { buildTasteProfile } from '@/recommender/taste';
import { useSeenKeys } from '@/store/seen';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';

/** Perfil de gusto memoizado: solo se recalcula si cambian initialRatings o entries. */
export function useTasteProfile(): TasteProfile {
  const userId = useProfileStore((s) => s.profile.id);
  const initialRatings = useProfileStore((s) => s.profile.initialRatings);
  const initialGenres = useProfileStore((s) => s.profile.initialGenres);
  const entries = useHistoryStore((s) => s.entries);
  // P6 (F3-1): el gusto sale de los géneros persistidos (swipe + historial).
  return useMemo(
    () => buildTasteProfile(userId, initialRatings, entries, initialGenres),
    [userId, initialRatings, entries, initialGenres],
  );
}

/** RankingContext (7.2) memoizado para pasar a los repositorios. */
export function useRankingContext(): RankingContext {
  const taste = useTasteProfile();
  const seenKeys = useSeenKeys();
  return useMemo(() => ({ userId: taste.userId, taste, seenKeys }), [taste, seenKeys]);
}
