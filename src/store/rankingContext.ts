import type { RankingContext } from '@/types/rating';
import { buildTasteProfile } from '@/recommender/taste';
import { selectSeenKeys } from './seen';
import { useHistoryStore } from './useHistoryStore';
import { useProfileStore } from './useProfileStore';

/** RankingContext (7.2) del usuario actual, leido de los stores sin suscribirse. */
export function getRankingContext(): RankingContext {
  const profileState = useProfileStore.getState();
  const history = useHistoryStore.getState();
  const { profile } = profileState;
  return {
    userId: profile.id,
    taste: buildTasteProfile(profile.id, profile.initialRatings, history.entries, profile.initialGenres),
    seenKeys: selectSeenKeys(profileState, history),
  };
}
