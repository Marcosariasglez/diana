import type { RatingRepository } from '../rating.repository';
import { entryTitle } from '../rating.repository';
import { getSupabase } from '@/lib/supabase';
import { titleOf } from '@/utils/media';
import { predictTenths } from '@/recommender/predict';
import { buildTasteProfile } from '@/recommender/taste';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { buildMediaKey } from '@/utils/mediaKey';
import { activeCatalogRepository } from '../catalog.select';
import { activeRecommender, contentPredictTenths } from '../recommender';
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
      // F2-2: la ficha comparte el modelo con el feed (RPC `predict_tenths`).
      // `contentPredictTenths` devuelve `null` si falla (sin sesión, sin RPC
      // desplegado, valor fuera de 10..50) → red de seguridad: heurística local.
      const byRpc =
        activeRecommender() === 'content' ? await contentPredictTenths(mediaRef.mediaType, mediaRef.mediaId) : null;
      if (byRpc !== null) {
        tenths = byRpc;
      } else {
        const { entries } = useHistoryStore.getState();
        const { profile } = useProfileStore.getState();
        tenths = predictTenths(
          buildTasteProfile(profile.id, profile.initialRatings, entries, profile.initialGenres),
          media,
          key,
        );
      }
      seen = origin === 'detail';
    }

    // Diario rápido: fija logged_at; conserva el previo si venía del Diario.
    const now = new Date().toISOString();
    const logged_at = origin === 'daily-log' ? now : (existing as { logged_at?: string | null })?.logged_at ?? null;

    const row: HistoryRow = {
      user_id: u.user.id, key, media_type: mediaRef.mediaType, media_id: mediaRef.mediaId,
      season: mediaRef.season ?? null, episode: mediaRef.episode ?? null,
      title: entryTitle(mediaRef, titleOf(media)), genre_ids: media.genres.map((g) => g.id),
      user_rating: userRating, ai_prediction_tenths: tenths, prediction_seen: seen,
      source: existing?.source ?? 'app', rated_at: now,
      logged_at,
    };

    // Intenta upsert con logged_at.
    let { error } = await sb.from('history_entries').upsert(row, { onConflict: 'user_id,key' });

    // Defensa PGRST204: si la columna logged_at aún no existe (migración 0023 pendiente),
    // reintenta una vez sin logged_at para no romper la app en vuelo.
    if (error && (error.code === 'PGRST204' || (error.message ?? '').includes('logged_at'))) {
      const rowFallback = { ...row } as Omit<HistoryRow, 'logged_at'>;
      delete (rowFallback as any).logged_at;
      ({ error } = await sb.from('history_entries').upsert(rowFallback, { onConflict: 'user_id,key' }));
    }

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
