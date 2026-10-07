import type { SupabaseClient } from '@supabase/supabase-js';
import type { InitialRating } from '@/types/rating';
import { getSupabase } from '@/lib/supabase';
import type { ProfileRepository, RemoteUserData } from '../profile.repository';
import { entryToRow, rowToEntry, type HistoryRow } from './mappers';

const PAGE = 1000;

async function selectAll<T>(sb: SupabaseClient, table: string, columns: string, order?: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

async function uid(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error('not-authenticated');
  return data.user.id;
}

export const supabaseProfileRepository: ProfileRepository = {
  async load() {
    const sb = getSupabase();
    const id = await uid(sb);
    const { data: p, error } = await sb.from('profiles').select('*').eq('id', id).single();
    if (error) throw error;
    const [ratings, rows, watched] = await Promise.all([
      selectAll<{ media_id: number; value: InitialRating; genre_ids: number[] }>(sb, 'initial_ratings', 'media_id,value,genre_ids'),
      selectAll<HistoryRow>(sb, 'history_entries', '*', 'rated_at'),
      selectAll<{ key: string }>(sb, 'watched', 'key'),
    ]);
    const data: RemoteUserData = {
      profile: {
        displayName: p.display_name,
        favoritePlatforms: p.favorite_platforms,
        favoriteGenres: p.favorite_genres,
        hasOnboarded: p.has_onboarded,
      },
      initialRatings: Object.fromEntries(ratings.map((r) => [r.media_id, r.value])),
      initialGenres: Object.fromEntries(ratings.map((r) => [r.media_id, r.genre_ids])),
      entries: rows.map(rowToEntry),
      watched: watched.map((w) => w.key),
    };
    return data;
  },
  async saveProfile(p) {
    const sb = getSupabase();
    const patch: Record<string, unknown> = {};
    if (p.displayName !== undefined) patch.display_name = p.displayName;
    if (p.favoritePlatforms !== undefined) patch.favorite_platforms = p.favoritePlatforms;
    if (p.favoriteGenres !== undefined) patch.favorite_genres = p.favoriteGenres;
    if (p.hasOnboarded !== undefined) patch.has_onboarded = p.hasOnboarded;
    const { error } = await sb.from('profiles').update(patch).eq('id', await uid(sb));
    if (error) throw error;
  },
  async saveInitialRating(mediaId, value, genreIds) {
    const sb = getSupabase();
    const { error } = await sb
      .from('initial_ratings')
      .upsert({ user_id: await uid(sb), media_id: mediaId, value, genre_ids: genreIds }, { onConflict: 'user_id,media_id' });
    if (error) throw error;
  },
  async saveImport(result) {
    const sb = getSupabase();
    const id = await uid(sb);
    for (let i = 0; i < result.entries.length; i += 500) {
      const batch = result.entries.slice(i, i + 500).map((e) => entryToRow(id, e));
      const { error } = await sb.from('history_entries').upsert(batch, { onConflict: 'user_id,key', ignoreDuplicates: true });
      if (error) throw error;
    }
    for (let i = 0; i < result.watched.length; i += 500) {
      const batch = result.watched.slice(i, i + 500).map((key) => ({ user_id: id, key }));
      const { error } = await sb.from('watched').upsert(batch, { onConflict: 'user_id,key', ignoreDuplicates: true });
      if (error) throw error;
    }
  },
  async removeEntry(key) {
    const sb = getSupabase();
    const { error } = await sb.from('history_entries').delete().eq('user_id', await uid(sb)).eq('key', key);
    if (error) throw error;
  },
};
