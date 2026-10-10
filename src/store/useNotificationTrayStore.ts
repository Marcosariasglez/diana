import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * VERTICE-PLAN-2, D2-4: bandeja de avisos «Ya está en tu plataforma».
 *
 * Avisos in-app (no push): cuando un título de «Quiero ver» pasa a estar
 * disponible en una plataforma del usuario. Persistidos localmente
 * (diana.notifications.v1); los avisos se marcan leídos al abrir la bandeja y
 * se descartan cuando el título sale de la watchlist.
 *
 * El campo `media` (título, año, poster) se resuelve contra el catálogo en la
 * vista: el catálogo cambia con cada sincronización y no se duplica aquí.
 */
export interface TrayNotice {
  id: string;
  /** Clave del título: `${mediaType}:${mediaId}`. */
  mediaType: 'movie' | 'tv';
  mediaId: number;
  /** Plataformas nuevas donde se ha detectado el título. */
  newPlatforms: string[];
  createdAt: string;
  read: boolean;
}

interface TrayState {
  notices: TrayNotice[];
  add: (n: Omit<TrayNotice, 'read'>) => void;
  markAllRead: () => void;
  removeForKeys: (keys: ReadonlySet<string>) => void;
  clear: () => void;
}

export const keyOf = (mediaType: 'movie' | 'tv', mediaId: number): string =>
  `${mediaType}:${mediaId}`;

const MAX_NOTICES = 50;

export const useNotificationTrayStore = create<TrayState>()(
  persist(
    (set) => ({
      notices: [],
      add: (n) =>
        set((s) => {
          const notice: TrayNotice = { ...n, read: false };
          // Un aviso vivo por título: si ya hay uno (leído o no) para la misma
          // clave, se refrescan plataformas y fecha en vez de duplicar.
          const idx = s.notices.findIndex((x) => keyOf(x.mediaType, x.mediaId) === notice.id);
          const rest = idx >= 0 ? s.notices.filter((_, i) => i !== idx) : s.notices;
          const next = [notice, ...rest].slice(0, MAX_NOTICES);
          return { notices: next };
        }),
      markAllRead: () =>
        set((s) => ({ notices: s.notices.map((n) => (n.read ? n : { ...n, read: true })) })),
      removeForKeys: (keys) =>
        set((s) => ({ notices: s.notices.filter((n) => !keys.has(keyOf(n.mediaType, n.mediaId))) })),
      clear: () => set({ notices: [] }),
    }),
    {
      name: 'diana.notifications.v1',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ notices: s.notices }),
    },
  ),
);

export const selectUnreadCount = (s: TrayState): number => s.notices.filter((n) => !n.read).length;
export const selectHasNotices = (s: TrayState): boolean => s.notices.length > 0;
export { keyOf as trayKeyOf };
