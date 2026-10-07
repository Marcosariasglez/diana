import { useMemo } from 'react';
import type { MediaKey } from '@/types/rating';
import { buildSeenKeys } from './seenKeys';
import { useHistoryStore, type HistoryState } from './useHistoryStore';
import { useProfileStore, type ProfileState } from './useProfileStore';

export { buildSeenKeys } from './seenKeys';

/** Vistos del usuario actual: union de entries, watched e initialRatings like/skip (6.1). */
export function selectSeenKeys(
  profile: Pick<ProfileState, 'profile'>,
  history: Pick<HistoryState, 'entries' | 'watched'>,
): ReadonlySet<MediaKey> {
  return buildSeenKeys({
    initialRatings: profile.profile.initialRatings,
    entries: history.entries,
    watched: history.watched,
  });
}

export function selectIsSeen(
  profile: Pick<ProfileState, 'profile'>,
  history: Pick<HistoryState, 'entries' | 'watched'>,
  key: MediaKey,
): boolean {
  return selectSeenKeys(profile, history).has(key);
}

/** Hook memoizado sobre los dos stores; solo recalcula si cambian sus tres fuentes. */
export function useSeenKeys(): ReadonlySet<MediaKey> {
  const initialRatings = useProfileStore((s) => s.profile.initialRatings);
  const entries = useHistoryStore((s) => s.entries);
  const watched = useHistoryStore((s) => s.watched);
  return useMemo(
    () => buildSeenKeys({ initialRatings, entries, watched }),
    [initialRatings, entries, watched],
  );
}
