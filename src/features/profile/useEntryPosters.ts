import { useEffect, useRef } from 'react';
import type { MediaKey } from '@/types/rating';
import type { HistoryEntry } from '@/types/rating';
import { activeCatalogSource } from '@/services/supabase/catalog/select';

const cache = new Map<MediaKey, string | null>();

/** Extrae la clave de medio sin temporada/episodio (series comparten póster). */
export function mediaKeyOf(entry: HistoryEntry): MediaKey {
  return `${entry.ref.mediaType}:${entry.ref.mediaId}`;
}

/**
 * Resuelve las rutas de póster para las entradas visibles.
 * Devuelve un Map<MediaKey, string | null>.
 * Usa caché a nivel de módulo y es tolerante a errores.
 */
export function useEntryPosters(entries: HistoryEntry[]): Map<MediaKey, string | null> {
  const result = useRef(new Map<MediaKey, string | null>());
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    const map = new Map<MediaKey, string | null>();
    const needed = new Map<string, MediaKey[]>();

    for (const entry of entries) {
      const key = mediaKeyOf(entry);
      const cached = cache.get(key);
      if (cached !== undefined) {
        map.set(key, cached);
      } else if (entry.posterPath) {
        map.set(key, entry.posterPath);
        cache.set(key, entry.posterPath);
      } else {
        map.set(key, null);
        const mediaType = entry.ref.mediaType;
        const id = entry.ref.mediaId;
        const mediaLookup = `${mediaType}:${id}`;
        const group = needed.get(mediaLookup);
        if (group) group.push(key);
        else needed.set(mediaLookup, [key]);
      }
    }

    // Resolución asíncrona en lotes de ≤ 50 (tolerante a errores)
    if (needed.size > 0 && !abortRef.current) {
      (async () => {
        for (const [mediaLookup, keys] of needed) {
          if (abortRef.current) break;
          const [mediaType, idStr] = mediaLookup.split(':');
          const id = Number(idStr);
          try {
            // Intenta por lotes
            const results = await activeCatalogSource.byIds(
              mediaType as 'movie' | 'tv',
              [id]
            );
            if (results.length > 0 && results[0].poster_path) {
              const path = results[0].poster_path;
              cache.set(keys[0], path);
              map.set(keys[0], path);
              for (let i = 1; i < keys.length; i++) {
                cache.set(keys[i], path);
                map.set(keys[i], path);
              }
            } else {
              for (const k of keys) {
                cache.set(k, null);
              }
            }
          } catch {
            // Silencia errores: los pósters son optativos
            for (const k of keys) {
              cache.set(k, null);
            }
          }
        }
        if (!abortRef.current) {
          result.current = map;
        }
      })();
    } else if (!abortRef.current) {
      result.current = map;
    }

    return () => {
      abortRef.current = true;
    };
  }, [entries]);

  return result.current;
}
