import type { AddEntryInput, HistoryEntry, MediaKey, MediaRef } from '@/types/rating';
import { fixtureMedia } from '@/test/fixtures/catalog';
import { titleOf } from '@/utils/media';
import { predict } from '@/recommender/predict';
import { buildTasteProfile } from '@/recommender/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { posterColor } from '@/utils/posterColor';

// P9: el tipo y entryTitle se exportaron a rating.types.ts; se mantiene el export aquí
// para compatibilidad (se borra este fichero en P9).
import type { RatingRepository } from './rating.types';
import { entryTitle } from './rating.types';
export type { RatingRepository } from './rating.types';
export { entryTitle } from './rating.types';

export const ratingRepository: RatingRepository = {
  async saveRating({ mediaRef, userRating, origin }) {
    const media = fixtureMedia(mediaRef.mediaType, mediaRef.mediaId);
    if (!media) throw new Error('media-not-found');
    const key = buildMediaKey(mediaRef);
    const { entries } = useHistoryStore.getState();
    const existing = entries.find((e) => e.key === key);
    const ratedAt = new Date().toISOString();
    // Diario rápido: marca la fecha de registro para que aparezca en el Perfil.
    const loggedAt = origin === 'daily-log' ? ratedAt : existing?.loggedAt ?? null;

    if (existing) {
      // Upsert: conserva aiPrediction, nunca baja predictionSeen, conserva loggedAt salvo daily-log.
      return {
        ...existing,
        userRating,
        ratedAt,
        loggedAt,
        predictionSeen: existing.predictionSeen || origin === 'detail',
      };
    }

    // La prediccion usa el perfil previo: la nota nueva todavia no esta en entries.
    const { profile } = useProfileStore.getState();
    const taste = buildTasteProfile(profile.id, profile.initialRatings, entries, profile.initialGenres);
    return {
      key,
      ref: { ...mediaRef },
      title: entryTitle(mediaRef, titleOf(media)),
      posterColor: posterColor(media.id),
      userRating,
      aiPrediction: predict(taste, media, key),
      predictionSeen: origin === 'detail',
      ratedAt,
      source: 'app',
      loggedAt,
    };
  },
  async getRating(key) {
    return useHistoryStore.getState().entries.find((e) => e.key === key) ?? null;
  },
  async getAllRatings() {
    return [...useHistoryStore.getState().entries];
  },
};
