import type { RatingRepository } from '../rating.repository';
import { entryTitle } from '../rating.repository';
import { getSupabase } from '@/lib/supabase';
import { titleOf } from '@/mocks/data/catalog';
import { predictTenths } from '@/mocks/mock-ai/predict';
import { buildTasteProfile } from '@/mocks/mock-ai/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { activeCatalogRepository } from '../catalog.select';
import { rowToEntry, type HistoryRow } from './mappers';

export const supabaseRatingRepository: RatingRepository = {
  async saveRating({ mediaRef, userRating, origin }) {
    const sb = getSupabase();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error('not-authenticated');
    const media = await activeCatalogRepository.getMediaById(mediaRef.mediaType, mediaRef.mediaId);
    if (!media) throw new Error('media-not-found');
    const key = buildMediaKey(mediaRef);

    const { data: existing, error: e1 } = await sb
      .from('history_entries').select('*').eq('user_id', u.user.id).eq('key', key).maybeSingle();
    if (e1) throw e1;

    let tenths: number;
    let seen: boolean;
    if (existing) {
      tenths = existing.ai_prediction_tenths;
      seen = existing.prediction_seen || origin === 'detail';
    } else {
      const { entries } = useHistoryStore.getState();
      const { profile } = useProfileStore.getState();
      tenths = predictTenths(buildTasteProfile(profile.id, profile.initialRatings, entries), media, key);
      seen = origin === 'detail';
    }
    const row: HistoryRow = {
      user_id: u.user.id, key, media_type: mediaRef.mediaType, media_id: mediaRef.mediaId,
      season: mediaRef.season ?? null, episode: mediaRef.episode ?? null,
      title: entryTitle(mediaRef, titleOf(media)), genre_ids: media.genres.map((g) => g.id),
      user_rating: userRating, ai_prediction_tenths: tenths, prediction_seen: seen,
      source: existing?.source ?? 'app', rated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('history_entries').upsert(row, { onConflict: 'user_id,key' });
    if (error) throw error;
    return rowToEntry(row);
  },
  async getRating(key) {
    const sb = getSupabase();
    const { data, error } = await sb.from('history_entries').select('*').eq('key', key).maybeSingle();
    if (error) throw error;
    return data ? rowToEntry(data as HistoryRow) : null;
  },
  async getAllRatings() {
    const sb = getSupabase();
    const { data, error } = await sb.from('history_entries').select('*').order('rated_at', { ascending: false }).limit(1000);
    if (error) throw error;
    return ((data ?? []) as HistoryRow[]).map(rowToEntry);
  },
};
