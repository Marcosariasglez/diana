import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useNotificationTrayStore } from '@/store/useNotificationTrayStore';
import { activeCatalogSource } from '@/services/supabase/catalog/select';
import { reportSyncError } from '@/lib/syncError';
import { BACKEND, CATALOG } from '@/lib/env';
import { detectNewlyAvailable, keyOf } from './availabilityLogic';
import { AVAILABILITY_BASELINE_KEY, AVAILABILITY_LAST_CHECK_KEY } from './availabilityKeys';

/**
 * VERTICE-PLAN-2, D2-4: orquesta la detección de «Ya está en tu plataforma».
 *
 * - Compara la watchlist contra el catálogo ACTUAL con una base guardada en
 *   AsyncStorage (`diana.availability.baseline.v1`): solo se avisa de
 *   plataformas NUEVAS respecto a la última comprobación (primera vez = solo
 *   se guarda la base, sin avisos).
 * - Cooldown de 1 h entre comprobaciones (no hay que golpear el catálogo en
 *   cada montaje): `CHECK_COOLDOWN_MS`.
 * - Solo tiene sentido con catálogo real (CATALOG=tmdb): con el mock el
 *   catálogo es estático y jamás cambia (no se guarda base ni se avisa).
 * - Limpia de la bandeja los avisos de títulos que ya no están en la
 *   watchlist.
 *
 * El hook no devuelve nada visible: su efecto es llenar
 * useNotificationTrayStore (lo leen la campana y la bandeja). Se monta una
 * vez en el layout de tabs.
 */
export const CHECK_COOLDOWN_MS = 60 * 60 * 1000;

type Baseline = Record<string, string[]>;

async function readBaseline(): Promise<Baseline> {
  try {
    const raw = await AsyncStorage.getItem(AVAILABILITY_BASELINE_KEY);
    return raw ? (JSON.parse(raw) as Baseline) : {};
  } catch {
    return {};
  }
}

async function readLastCheck(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(AVAILABILITY_LAST_CHECK_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function useAvailabilityNotifications(): { checking: boolean } {
  const items = useWatchlistStore((s) => s.items);
  const platforms = useProfileStore((s) => s.profile.favoritePlatforms);
  const [checking, setChecking] = useState(false);
  // La watchlist cambia en cada render donde se toca; el efecto solo se
  // re-ejecuta tras cambios relevantes (items, plataformas, hidratación).
  const hydrated = useProfileStore((s) => s.hasHydrated);
  const inFlight = useRef(false);
  const runId = useRef(0);

  // Limpieza: los avisos de títulos fuera de la watchlist se descartan. Si la
  // watchlist está VACÍA se limpia toda la bandeja (los avisos de la cuenta
  // anterior no pueden quedar visibles: el efecto no se re-ejecuta hasta que
  // haya elementos y `resetLocalStores` no cubre el caso «misma sesión, el
  // usuario vacía su lista»).
  useEffect(() => {
    if (items.length === 0) {
      useNotificationTrayStore.getState().clear();
      return;
    }
    const alive = new Set(items.map((i) => keyOf(i)));
    const tray = useNotificationTrayStore.getState().notices;
    const stale = tray.filter((n) => !alive.has(keyOf(n)));
    if (stale.length > 0) {
      useNotificationTrayStore.getState().removeForKeys(new Set(stale.map((n) => keyOf(n))));
    }
  }, [items]);

  const runCheck = useCallback(async () => {
    if (inFlight.current) return;
    const now = Date.now();
    const last = await readLastCheck();
    if (now - last < CHECK_COOLDOWN_MS) return;
    if (items.length === 0 || platforms.length === 0) return;

    inFlight.current = true;
    setChecking(true);
    const id = ++runId.current;
    try {
      // Resolución contra el catálogo (un viaje por tipo, como en la sección
      // «Quiero ver»). Si el catálogo no está (0006 sin desplegar), no se
      // toca la base ni se avisa.
      const movieIds = items.filter((i) => i.mediaType === 'movie').map((i) => i.mediaId);
      const tvIds = items.filter((i) => i.mediaType === 'tv').map((i) => i.mediaId);
      const [movies, tvs] = await Promise.all([
        movieIds.length ? activeCatalogSource.byIds('movie', movieIds) : [],
        tvIds.length ? activeCatalogSource.byIds('tv', tvIds) : [],
      ]);
      if (id !== runId.current) return; // se des-montó / re-ejecutó
      const byKey = new Map<string, (typeof movies)[number]>();
      for (const m of [...movies, ...tvs]) byKey.set(keyOf({ mediaType: m.media_type, mediaId: m.id }), m);

      const baseline = await readBaseline();
      if (id !== runId.current) return; // se des-montó en el último await
      const { news, nextBaseline } = detectNewlyAvailable(
        items,
        (mediaType, mediaId) => byKey.get(keyOf({ mediaType, mediaId })),
        platforms,
        baseline,
      );

      // Con CATALOG=mock el catálogo no cambia: no se fija base (no se
      // generarían avisos falsos) ni se marca la hora.
      if (CATALOG !== 'mock' && BACKEND !== 'mock') {
        await AsyncStorage.setItem(AVAILABILITY_BASELINE_KEY, JSON.stringify(nextBaseline));
        await AsyncStorage.setItem(AVAILABILITY_LAST_CHECK_KEY, String(now));
      }
      if (news.length > 0) {
        const add = useNotificationTrayStore.getState().add;
        for (const n of news) {
          add({
            id: keyOf(n),
            mediaType: n.mediaType,
            mediaId: n.mediaId,
            newPlatforms: n.newPlatforms,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      reportSyncError(new Error('availability-check-failed'));
    } finally {
      if (id === runId.current) {
        inFlight.current = false;
        setChecking(false);
      }
    }
  }, [items, platforms]);

  useEffect(() => {
    if (!hydrated) return;
    void runCheck();
    return () => {
      // Desmontaje (p. ej. cierre de sesión → /login): invalida la
      // comprobación en vuelo para que no escriba en bandeja/storage DESPUÉS
      // del cierre (un add() tardío reescribiría la clave diana.* que acaba
      // de limpiar el cierre de sesión).
      runId.current += 1;
      inFlight.current = false;
    };
  }, [runCheck, hydrated]);

  return { checking };
}
