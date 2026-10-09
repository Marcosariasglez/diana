// VERTICE-PLAN-2, D2-4: «Ya está en tu plataforma».
//
// Detecta, entre comprobaciones, si un título de «Quiero ver» pasa a estar
// disponible en una plataforma del usuario comparando las plataformas ACTUALES
// (catálogo, que cambia con cada sincronización) con una BASE GUARDADA
// (lo que estaba disponible la última vez que se comprobó).
//
// Reglas (lógica pura, sin I/O):
//  - Sin base para un título (primera vez que se ve): se GUARDA como base pero
//    NO se genera aviso — evita un aluvión de avisos en la primera sesión.
//  - Con base: se avisa si alguna plataforma actual (del usuario) NO estaba en
//    la base. El aviso indica las plataformas NUEVAS.
//  - Solo cuentan las plataformas que están en las preferidas del usuario.
//  - Si un título ya no está disponible en ninguna plataforma propia: se
//    actualiza la base a [] (si luego vuelve, se avisa de nuevo).
//
// El «cuándo» y el «dónde» (AsyncStorage, cooldown, catálogo) los gestiona el
// hook useAvailabilityNotifications; esto es puro y testeable.

import type { Media, MediaType } from '@/types/media';
import { platformName } from '@/constants/platforms';
import { mediaTitle } from '@/components/features/mediaHelpers';

export interface WatchlistRef {
  mediaType: MediaType;
  mediaId: number;
}

export const keyOf = (r: Pick<WatchlistRef, 'mediaType' | 'mediaId'>): string =>
  `${r.mediaType}:${r.mediaId}`;

export interface AvailabilityCheckItem extends WatchlistRef {
  key: string;
  media: Media;
  /** Plataformas (del usuario) donde está disponible AHORA. */
  nowPlatforms: string[];
  /** true = hay al menos una plataforma nueva respecto a la base. */
  isNews: boolean;
  /** Plataformas nuevas (para el cuerpo del aviso). */
  newPlatforms: string[];
}

export interface AvailabilityResult {
  /** Avisos nuevos (títulos que han ganado plataforma propia). */
  news: AvailabilityCheckItem[];
  /** Nueva base completa (para persistir): key → plataformas propias actuales. */
  nextBaseline: Record<string, string[]>;
}

/**
 * @param items      títulos de la watchlist.
 * @param resolve    (mediaType, mediaId) → Media resuelto del catálogo (o undefined si ya no existe).
 * @param ownPlatforms plataformas favoritas del usuario.
 * @param baseline   base guardada de la última comprobación (key → plataformas propias de entonces).
 */
export function detectNewlyAvailable(
  items: ReadonlyArray<WatchlistRef>,
  resolve: (mediaType: MediaType, mediaId: number) => Media | undefined,
  ownPlatforms: ReadonlyArray<string>,
  baseline: Readonly<Record<string, string[]>>,
): AvailabilityResult {
  const own = new Set(ownPlatforms);
  const news: AvailabilityCheckItem[] = [];
  const nextBaseline: Record<string, string[]> = {};

  for (const item of items) {
    const key = keyOf(item);
    const media = resolve(item.mediaType, item.mediaId);
    const nowPlatforms = media
      ? [...new Set(media.platforms)].filter((p) => own.has(p)).sort()
      : [];
    nextBaseline[key] = nowPlatforms;

    const prev = baseline[key];
    if (prev === undefined) continue; // primera vez: solo se guarda la base

    const newPlatforms = nowPlatforms.filter((p) => !prev.includes(p));
    if (newPlatforms.length > 0 && media) {
      news.push({ ...item, key, media, nowPlatforms, isNews: true, newPlatforms });
    }
  }
  return { news, nextBaseline };
}

/** «Ya está en tu plataforma: {título}» + «Ahora en Netflix y Prime Video». */
export function availabilityMessage(item: AvailabilityCheckItem): { title: string; body: string } {
  const names = item.newPlatforms.map(platformName);
  const conj = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  return {
    title: `Ya está en tu plataforma: ${mediaTitle(item.media)}`,
    body: `«${mediaTitle(item.media)}» ahora está en ${conj}.`,
  };
}
