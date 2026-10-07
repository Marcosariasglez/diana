import type { AddEntryInput, HistoryEntry, MediaKey, MediaRef } from '@/types/rating';
import { getMedia, titleOf } from '@/mocks/data/catalog';
import { fakeDelay } from '@/mocks/latency';
import { predict } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { posterColor } from '@/utils/posterColor';

export interface RatingRepository {
  saveRating(input: AddEntryInput): Promise<HistoryEntry>;
  getRating(key: MediaKey): Promise<HistoryEntry | null>;
  getAllRatings(): Promise<HistoryEntry[]>;
}

/** Titulo desnormalizado: "Fallout", "Fallout T1", "Fallout T1 · E3". */
export function entryTitle(ref: MediaRef, baseTitle: string): string {
  if (ref.season === undefined) return baseTitle;
  const season = `${baseTitle} T${ref.season}`;
  return ref.episode === undefined ? season : `${season} · E${ref.episode}`;
}

export const ratingRepository: RatingRepository = {
  async saveRating({ mediaRef, userRating, origin }) {
    await fakeDelay();
    const media = getMedia(mediaRef.mediaType, mediaRef.mediaId);
    if (!media) throw new Error('media-not-found');
    const key = buildMediaKey(mediaRef);
    const { entries } = useHistoryStore.getState();
    const existing = entries.find((e) => e.key === key);
    const ratedAt = new Date().toISOString();

    if (existing) {
      // Upsert: conserva aiPrediction y nunca baja predictionSeen de true a false.
      return {
        ...existing,
        userRating,
        ratedAt,
        predictionSeen: existing.predictionSeen || origin === 'detail',
      };
    }

    // La prediccion usa el perfil previo: la nota nueva todavia no esta en entries.
    const { profile } = useProfileStore.getState();
    const taste = buildTasteProfile(profile.id, profile.initialRatings, entries);
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
    };
  },
  async getRating(key) {
    await fakeDelay();
    return useHistoryStore.getState().entries.find((e) => e.key === key) ?? null;
  },
  async getAllRatings() {
    await fakeDelay();
    return [...useHistoryStore.getState().entries];
  },
};
