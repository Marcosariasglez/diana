import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MediaType } from '@/types/media';

/**
 * VERTICE-PLAN-2, D2-3: «Quiero ver». Lista personal de títulos por ver
 * (tipo + id + fecha). El título/año/plataformas se resuelven en la vista
 * contra el catálogo (cambian con cada sincronización; no se duplican aquí).
 *
 * Persistencia local (AsyncStorage, clave diana.watchlist.v1) + espejo en la
 * tabla `watchlist` (migración 0008) en modo Supabase: la fuente de verdad
 * al iniciar sesión es el servidor (bootstrapUserData); fuera de línea o en
 * modo mock solo existe la copia local.
 */
export interface WatchlistItem {
  mediaType: MediaType;
  mediaId: number;
  /** ISO; cuando se añadió a la lista. */
  addedAt: string;
}

interface WatchlistState {
  items: WatchlistItem[];
  add: (mediaType: MediaType, mediaId: number) => void;
  remove: (mediaType: MediaType, mediaId: number) => void;
  toggle: (mediaType: MediaType, mediaId: number) => void;
  has: (mediaType: MediaType, mediaId: number) => boolean;
  /** Sobrescribe la lista (hidratación desde el servidor). */
  setItems: (items: WatchlistItem[]) => void;
}

const keyOf = (mediaType: MediaType, mediaId: number) => `${mediaType}:${mediaId}`;

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (mediaType, mediaId) =>
        set((s) =>
          s.items.some((i) => keyOf(i.mediaType, i.mediaId) === keyOf(mediaType, mediaId))
            ? s
            : { items: [...s.items, { mediaType, mediaId, addedAt: new Date().toISOString() }] },
        ),
      remove: (mediaType, mediaId) =>
        set((s) => ({ items: s.items.filter((i) => keyOf(i.mediaType, i.mediaId) !== keyOf(mediaType, mediaId)) })),
      toggle: (mediaType, mediaId) => {
        const { items } = get();
        if (items.some((i) => keyOf(i.mediaType, i.mediaId) === keyOf(mediaType, mediaId))) {
          get().remove(mediaType, mediaId);
        } else {
          get().add(mediaType, mediaId);
        }
      },
      has: (mediaType, mediaId) => get().items.some((i) => keyOf(i.mediaType, i.mediaId) === keyOf(mediaType, mediaId)),
      setItems: (items) => set({ items }),
    }),
    {
      name: 'diana.watchlist.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
    },
  ),
);
