import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import type { WatchlistItem } from '@/store/useWatchlistStore';
import type { WatchlistRepository } from '../watchlist.repository';

interface WatchlistRow {
  media_type: WatchlistItem['mediaType'];
  media_id: number;
  added_at: string;
}

const PAGE = 1000;

async function selectAll(sb: SupabaseClient): Promise<WatchlistRow[]> {
  const out: WatchlistRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('watchlist')
      .select('media_type,media_id,added_at')
      .range(from, from + PAGE - 1)
      .order('added_at', { ascending: false });
    if (error) throw error;
    out.push(...((data ?? []) as WatchlistRow[]));
    if (!data || data.length < PAGE) return out;
  }
}

export const supabaseWatchlistRepository: WatchlistRepository = {
  async load() {
    const sb = getSupabase();
    const rows = await selectAll(sb);
    return rows.map((r) => ({ mediaType: r.media_type, mediaId: r.media_id, addedAt: r.added_at }));
  },
  async upsert(item) {
    const sb = getSupabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error('not-authenticated');
    // added_at viene del cliente: conserva la fecha local si la fila ya existe
    // (upsert con on conflict actualiza media_id/added_at; no afecta si no existe).
    const { error } = await sb.from('watchlist').upsert(
      {
        user_id: data.user.id,
        media_type: item.mediaType,
        media_id: item.mediaId,
        added_at: item.addedAt,
      },
      { onConflict: 'user_id,media_type,media_id' },
    );
    if (error) throw error;
  },
  async remove(mediaType, mediaId) {
    const sb = getSupabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error('not-authenticated');
    const { error } = await sb
      .from('watchlist')
      .delete()
      .eq('user_id', data.user.id)
      .eq('media_type', mediaType)
      .eq('media_id', mediaId);
    if (error) throw error;
  },
};
