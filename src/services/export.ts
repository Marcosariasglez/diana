import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getSupabase } from '@/lib/supabase';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import type { HistoryRow } from './supabase/mappers';

/**
 * A5 · «Exportar mis datos».
 * Lee las tablas del usuario con la sesión del propio usuario (RLS: solo ve
 * lo suyo) y genera un JSON { app: 'diana', exportedAt, user, ... }.
 * Web: descarga por Blob. Nativo: archivo en la carpeta de documentos +
 * hoja de compartir (expo-sharing).
 * Nombre: diana-mis-datos-AAAA-MM-DD.json
 */

const PAGE = 1000;

async function selectAll<T>(table: string, columns: string, order?: string): Promise<T[]> {
  const sb = getSupabase();
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

export interface ExportPayload {
  app: 'diana';
  exportedAt: string;
  user: { id: string; email: string | null };
  profile: { displayName: string; favoritePlatforms: string[]; favoriteGenres: number[]; hasOnboarded: boolean };
  initialRatings: Array<{ mediaId: number; value: string; genreIds: number[] }>;
  historyEntries: Array<{
    key: string;
    mediaType: string;
    mediaId: number;
    season: number | null;
    episode: number | null;
    title: string;
    userRating: number;
    source: string;
    ratedAt: string;
  }>;
  watched: string[];
  rooms: Array<{ code: string; isHost: boolean }>;
  /** D2-3: «Quiero ver». */
  watchlist: Array<{ mediaType: string; mediaId: number; addedAt: string }>;
}

const dateStamp = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const exportFileName = (d: Date = new Date()): string =>
  `diana-mis-datos-${dateStamp(d)}.json`;

/** Construye el payload completo desde el servidor (RLS: solo datos del usuario). */
export async function buildExportPayload(): Promise<ExportPayload> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const userId = data.session?.user.id ?? useProfileStore.getState().profile.id;
  const email = data.session?.user.email ?? null;

  const [profileRow, ratings, rows, watched, rooms, memberships, watchlistRows] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    selectAll<{ media_id: number; value: string; genre_ids: number[] }>('initial_ratings', 'media_id,value,genre_ids'),
    selectAll<HistoryRow>('history_entries', '*', 'rated_at'),
    selectAll<{ key: string }>('watched', 'key'),
    selectAll<{ code: string; host_id: string }>('rooms', 'code,host_id'),
    selectAll<{ code: string }>('room_members', 'code'),
    // D2-3: si la tabla 0008 no está desplegada, la query falla y el export
    // degrada a la copia local (no rompe el resto del payload).
    selectAll<{ media_type: string; media_id: number; added_at: string }>('watchlist', 'media_type,media_id,added_at').catch(
      () => useWatchlistStore.getState().items.map((i) => ({ media_type: i.mediaType, media_id: i.mediaId, added_at: i.addedAt })),
    ),
  ]);
  if (profileRow.error) throw profileRow.error;

  // rooms: solo las que le pertenecen (anfitrión o miembro).
  const mine = new Set(memberships.map((m) => m.code));
  const roomRows = rooms.filter((r) => r.host_id === userId || mine.has(r.code));

  return {
    app: 'diana',
    exportedAt: new Date().toISOString(),
    user: { id: userId, email },
    profile: {
      displayName: profileRow.data?.display_name ?? useProfileStore.getState().profile.displayName,
      favoritePlatforms: profileRow.data?.favorite_platforms ?? useProfileStore.getState().profile.favoritePlatforms,
      favoriteGenres: profileRow.data?.favorite_genres ?? useProfileStore.getState().profile.favoriteGenres,
      hasOnboarded: profileRow.data?.has_onboarded ?? useProfileStore.getState().hasOnboarded,
    },
    initialRatings: ratings.map((r) => ({ mediaId: r.media_id, value: r.value, genreIds: r.genre_ids })),
    historyEntries: rows.map((r) => ({
      key: r.key,
      mediaType: r.media_type,
      mediaId: r.media_id,
      season: r.season ?? null,
      episode: r.episode ?? null,
      title: r.title,
      userRating: Number(r.user_rating),
      source: r.source,
      ratedAt: r.rated_at,
    })),
    watched: watched.map((w) => w.key),
    rooms: roomRows.map((r) => ({ code: r.code, isHost: r.host_id === userId })),
    watchlist: watchlistRows.map((w) => ({ mediaType: w.media_type, mediaId: w.media_id, addedAt: w.added_at })),
  };
}

/** Payload solo con la copia local (degradación sin red/servidor). */
export function buildLocalExportPayload(): ExportPayload {
  const local = useHistoryStore.getState();
  const prof = useProfileStore.getState().profile;
  const hasOnboarded = useProfileStore.getState().hasOnboarded;
  return {
    app: 'diana',
    exportedAt: new Date().toISOString(),
    user: { id: prof.id, email: null },
    profile: {
      displayName: prof.displayName,
      favoritePlatforms: prof.favoritePlatforms,
      favoriteGenres: prof.favoriteGenres,
      hasOnboarded,
    },
    initialRatings: Object.entries(prof.initialRatings).map(([id, value]) => ({
      mediaId: Number(id),
      value,
      genreIds: [],
    })),
    historyEntries: local.entries.map((e) => ({
      key: e.key,
      mediaType: e.ref.mediaType,
      mediaId: e.ref.mediaId,
      season: e.ref.season ?? null,
      episode: e.ref.episode ?? null,
      title: e.title,
      userRating: e.userRating,
      source: e.source,
      ratedAt: e.ratedAt,
    })),
    watched: local.watched,
    rooms: [],
    watchlist: useWatchlistStore
      .getState()
      .items.map((i) => ({ mediaType: i.mediaType, mediaId: i.mediaId, addedAt: i.addedAt })),
  };
}

async function writeNativeFile(json: string): Promise<File> {
  const dir = new Directory(Paths.document, 'export');
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, exportFileName());
  if (file.exists) file.delete();
  file.create();
  file.write(json, { encoding: 'utf8' });
  return file;
}

async function shareNativeFile(file: File): Promise<void> {
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Mis datos de Diana',
  });
}

function downloadWebFile(json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface ExportResult {
  ok: boolean;
  message: string;
}

/**
 * Descarga (web) o comparte (nativo) el JSON con todos los datos del usuario.
 * Si el servidor no responde, degrada a la copia local (se avisa).
 */
export async function exportMyData(): Promise<ExportResult> {
  let payload: ExportPayload;
  let local = false;
  try {
    payload = await buildExportPayload();
  } catch {
    payload = buildLocalExportPayload();
    local = true;
  }

  const json = JSON.stringify(payload, null, 2);
  const suffix = local ? ' (copia local)' : '';

  try {
    if (Platform.OS === 'web') {
      downloadWebFile(json);
      return { ok: true, message: `Datos descargados${suffix}` };
    }
    const file = await writeNativeFile(json);
    await shareNativeFile(file);
    return { ok: true, message: `Datos compartidos${suffix}` };
  } catch {
    return { ok: false, message: 'No se pudieron exportar tus datos' };
  }
}
