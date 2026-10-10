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
 *
 * COHERENCIA OFFLINE (hallazgo «Server bootstrap discards pending offline
 * mutations»): las operaciones locales que NO llegaron al servidor (un upsert
 * de alta o un delete de baja que falló con la red caída) quedan registradas
 * en `pendingAdds` / `pendingRemovals` (tombstones). El bootstrap NO sustituye
 * la lista de forma ciega: la reconcilia contra el snapshot del servidor con
 * `reconcileWithServer` (reaplica las altas pendientes y vuelve a borrar las
 * bajas pendientes ANTES de tratar el snapshot como autoritativo) y luego
 * reintenta el empuje con `markPushed`/`markRemoved` al lograrlo. Así una alta
 * offline no desaparece y una baja offline no reaparece en el siguiente login.
 */
export interface WatchlistItem {
  mediaType: MediaType;
  mediaId: number;
  /** ISO; cuando se añadió a la lista. */
  addedAt: string;
}

interface WatchlistState {
  items: WatchlistItem[];
  /** Altas aplicadas localmente cuyo espejo al servidor falló (o aún no se empujó). */
  pendingAdds: WatchlistItem[];
  /** Claves `${mediaType}:${mediaId}` de bajas aplicadas localmente cuyo delete falló. */
  pendingRemovals: string[];
  add: (mediaType: MediaType, mediaId: number) => void;
  remove: (mediaType: MediaType, mediaId: number) => void;
  toggle: (mediaType: MediaType, mediaId: number) => void;
  has: (mediaType: MediaType, mediaId: number) => boolean;
  /** Sobrescribe la lista (hidratación desde el servidor). NO toca pending. */
  setItems: (items: WatchlistItem[]) => void;
  /**
   * Pura: snapshot del servidor + altas pendientes − bajas pendientes.
   * Devuelve la lista a aplicar SIN mutar (la aplica luego setItems).
   */
  reconcileWithServer: (serverItems: WatchlistItem[]) => WatchlistItem[];
  /** El upsert del servidor logró: retira la alta de pendingAdds. */
  markPushed: (mediaType: MediaType, mediaId: number) => void;
  /** El delete del servidor logró: retira la baja de pendingRemovals. */
  markRemoved: (mediaType: MediaType, mediaId: number) => void;
  /** Vacía la cola (cambio de cuenta / cierre de sesión). */
  clearPending: () => void;
}

const keyOf = (mediaType: MediaType, mediaId: number) => `${mediaType}:${mediaId}`;

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      pendingAdds: [],
      pendingRemovals: [],
      add: (mediaType, mediaId) =>
        set((s) => {
          const k = keyOf(mediaType, mediaId);
          const already = s.items.some((i) => keyOf(i.mediaType, i.mediaId) === k);
          if (already) return s;
          const item: WatchlistItem = { mediaType, mediaId, addedAt: new Date().toISOString() };
          const pendingAdds = s.pendingAdds.some((i) => keyOf(i.mediaType, i.mediaId) === k)
            ? s.pendingAdds
            : [...s.pendingAdds, item];
          return { items: [...s.items, item], pendingAdds };
        }),
      remove: (mediaType, mediaId) =>
        set((s) => {
          const k = keyOf(mediaType, mediaId);
          return {
            items: s.items.filter((i) => keyOf(i.mediaType, i.mediaId) !== k),
            pendingRemovals: s.pendingRemovals.includes(k) ? s.pendingRemovals : [...s.pendingRemovals, k],
          };
        }),
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
      reconcileWithServer: (serverItems) => {
        const { pendingAdds, pendingRemovals } = get();
        const serverKeys = new Set(serverItems.map((i) => keyOf(i.mediaType, i.mediaId)));
        // El snapshot del servidor es la base; se reaplican las altas pendientes
        // (todavía no en el servidor) y se re-borran las bajas pendientes
        // (el servidor aún las tiene).
        const merged: WatchlistItem[] = [...serverItems];
        for (const p of pendingAdds) {
          if (!serverKeys.has(keyOf(p.mediaType, p.mediaId))) merged.push(p);
        }
        const removals = new Set(pendingRemovals);
        return merged.filter((m) => !removals.has(keyOf(m.mediaType, m.mediaId)));
      },
      markPushed: (mediaType, mediaId) =>
        set((s) => ({
          pendingAdds: s.pendingAdds.filter((i) => keyOf(i.mediaType, i.mediaId) !== keyOf(mediaType, mediaId)),
        })),
      markRemoved: (mediaType, mediaId) =>
        set((s) => ({
          pendingRemovals: s.pendingRemovals.filter((k) => k !== keyOf(mediaType, mediaId)),
        })),
      clearPending: () => set({ pendingAdds: [], pendingRemovals: [] }),
    }),
    {
      name: 'diana.watchlist.v1',
      version: 2,
      // v1 → v2: la forma persistida gana pendingAdds/pendingRemovals. Estados
      // antiguos (solo items) se rehidratan con la cola vacía.
      migrate: (persisted) => {
        const s = persisted as Partial<WatchlistState>;
        return {
          ...s,
          pendingAdds: Array.isArray(s.pendingAdds) ? s.pendingAdds : [],
          pendingRemovals: Array.isArray(s.pendingRemovals) ? s.pendingRemovals : [],
        } as WatchlistState;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items, pendingAdds: s.pendingAdds, pendingRemovals: s.pendingRemovals }),
    },
  ),
);
