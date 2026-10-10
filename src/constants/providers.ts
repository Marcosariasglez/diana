/**
 * ÚNICO origen de verdad de los proveedores (plataformas) para España.
 * (VERTICE-PLAN-2, D2-1.1)
 *
 * LO IMPORTA:
 *   - La app (cliente) vía `@/constants/providers` (src/constants/platforms.ts lo
 *     deriva) y
 *   - La Edge Function `supabase/functions/tmdb` por path relativo
 *     (`../../../src/constants/providers.ts`) para construir PROVIDER_MAP y el
 *     filtro `with_watch_providers`.
 *
 * Por eso este fichero es PURA DATOS: sin imports, sin React Native, sin alias `@/`.
 * Si algún día no pudiera importarse desde Deno, la alternativa documentada es
 * "generar uno desde el otro" (script) o una prueba que compare ambos.
 *
 * ESTADO DE LOS IDS TMDB (importante):
 *   - VERIFICADOS EN VIVO el 2026-10-10 contra `/watch/providers/movie` y `/tv`
 *     con `watch_region=ES` (acción `providers` del plan). LECCIÓN: el PROVIDER_MAP
 *     anterior traía ids erróneos (prime-video 9, max 384, apple-tv 531, filmin 275,
 *     mubi 387, rtve-play 179, rakuten-tv 350, pluto-tv 362): solo netflix (8) y
 *     disney-plus (337) eran correctos. Vuelve a verificarlos SIEMPRE que un sync
 *     parezca escribir plataformas imposibles.
 *   - `tmdbProviderId: null` = sin presencia en ES en TMDB (no entra en el filtro
 *     `with_watch_providers`): va en `PENDING_VERIFICATION` y la sincronización lo
 *     SALTA. Es el caso de `paramount-plus` (no aparece en la lista ES de TMDB).
 */

export type Monetization = 'flatrate' | 'svod' | 'tvod' | 'free';

export interface ProviderDef {
  /** id estable que guarda la app y la base de datos (`favorite_platforms`,
   *  `platforms_flatrate`, …). NUNCA se renombra (rompería datos guardados). */
  id: string;
  /** Nombre para mostrar en la interfaz. */
  name: string;
  /** id del watch-provider de TMDB. `null` = pendiente de verificación (no se
   *  consulta todavía). */
  tmdbProviderId: number | null;
  /** Opera en España (solo estos entran en la sincronización del catálogo). */
  es: boolean;
  /** Tipo de monetización principal (informativo; la sincronización hace pases
   *  separados por flatrate y rent|buy). */
  monetization: Monetization;
}

/**
 * Lista de proveedores. Orden: primero los activos en ES (los que sincroniza el
 * catálogo), luego los nuevos pendientes de verificar id, y al final los
 * desactualizados/fuera de ES (se conservan para renderizar datos guardados y no
 * romper `favorite_platforms` antiguos; nunca entran en el filtro de TMDB).
 */
export const PROVIDERS: readonly ProviderDef[] = [
  // --- Activos en ES — ids VERIFICADOS en vivo (2026-10-10, /watch/providers ES) ---
  { id: 'netflix', name: 'Netflix', tmdbProviderId: 8, es: true, monetization: 'flatrate' },
  { id: 'prime-video', name: 'Prime Video', tmdbProviderId: 119, es: true, monetization: 'flatrate' },
  { id: 'max', name: 'Max', tmdbProviderId: 1899, es: true, monetization: 'flatrate' },
  { id: 'disney-plus', name: 'Disney+', tmdbProviderId: 337, es: true, monetization: 'flatrate' },
  { id: 'apple-tv', name: 'Apple TV+', tmdbProviderId: 350, es: true, monetization: 'flatrate' },
  { id: 'filmin', name: 'Filmin', tmdbProviderId: 63, es: true, monetization: 'flatrate' },
  { id: 'mubi', name: 'MUBI', tmdbProviderId: 11, es: true, monetization: 'flatrate' },
  { id: 'rtve-play', name: 'RTVE Play', tmdbProviderId: 541, es: true, monetization: 'free' },
  { id: 'rakuten-tv', name: 'Rakuten TV', tmdbProviderId: 35, es: true, monetization: 'svod' },
  { id: 'pluto-tv', name: 'Pluto TV', tmdbProviderId: 300, es: true, monetization: 'free' },
  { id: 'movistar-plus', name: 'Movistar Plus+', tmdbProviderId: 2241, es: true, monetization: 'flatrate' },
  { id: 'skyshowtime', name: 'SkyShowtime', tmdbProviderId: 1773, es: true, monetization: 'flatrate' },
  { id: 'atresplayer', name: 'Atresplayer', tmdbProviderId: 62, es: true, monetization: 'free' },
  { id: 'plex', name: 'Plex', tmdbProviderId: 538, es: true, monetization: 'svod' },
  { id: 'youtube', name: 'YouTube', tmdbProviderId: 188, es: true, monetization: 'tvod' },

  // --- En el plan y en la UI, pero SIN presencia en ES en TMDB (no se pueden
  //     sincronizar; tmdbProviderId null → PENDING_VERIFICATION, la sync salta).
  { id: 'paramount-plus', name: 'Paramount+', tmdbProviderId: null, es: true, monetization: 'flatrate' },

  // --- Desactualizados / fuera de ES (solo para no romper datos guardados;
  //     nunca entran en el filtro de TMDB) --------------------------------------
  { id: 'mitele', name: 'Mitele', tmdbProviderId: 197, es: false, monetization: 'flatrate' },
  { id: 'discovery-plus', name: 'Discovery+', tmdbProviderId: 332, es: false, monetization: 'flatrate' },
  { id: 'britbox', name: 'BritBox', tmdbProviderId: 216, es: false, monetization: 'flatrate' },
  { id: 'starzplay', name: 'Starzplay', tmdbProviderId: 444, es: false, monetization: 'flatrate' },
  { id: 'hbo-es', name: 'HBO ES', tmdbProviderId: 586, es: false, monetization: 'flatrate' },
  { id: 'nova-play', name: 'Nova Play', tmdbProviderId: 255, es: false, monetization: 'flatrate' },
  { id: 'zee5', name: 'ZEE5', tmdbProviderId: 110, es: false, monetization: 'flatrate' },
  { id: 'hotstar', name: 'Hotstar', tmdbProviderId: 294, es: false, monetization: 'flatrate' },
  { id: 'vidAngel', name: 'VidAngel', tmdbProviderId: 443, es: false, monetization: 'tvod' },
  { id: 'peacock', name: 'Peacock', tmdbProviderId: 155, es: false, monetization: 'flatrate' },
  { id: 'criterion', name: 'Criterion', tmdbProviderId: 17, es: false, monetization: 'tvod' },
];

/** id (app) → definición. */
export const PROVIDER_BY_ID: ReadonlyMap<string, ProviderDef> = new Map(
  PROVIDERS.map((p) => [p.id, p]),
);

/** id TMDB → id (app). Solo los que tienen id verificado. */
export const PROVIDER_BY_TMDB_ID: ReadonlyMap<number, string> = new Map(
  PROVIDERS.filter((p) => p.tmdbProviderId != null).map((p) => [p.tmdbProviderId as number, p.id]),
);

/**
 * Filtro `with_watch_providers` para TMDB: ids (TMDB) de los proveedores activos en
 * ES y con id verificado, unidos por `|`. (Los `null` se descartan.)
 */
export const PROVIDER_FILTER: string = PROVIDERS.filter(
  (p) => p.es && p.tmdbProviderId != null,
)
  .map((p) => String(p.tmdbProviderId))
  .join('|');

/** Proveedores activos en ES cuyo id TMDB falta (pendientes de verificación). */
export const PENDING_VERIFICATION: readonly string[] = PROVIDERS.filter(
  (p) => p.es && p.tmdbProviderId == null,
).map((p) => p.id);

/** Proveedores activos en ES (con o sin id verificado) — para el UI «Explorar». */
export const ES_PROVIDERS: readonly ProviderDef[] = PROVIDERS.filter((p) => p.es);
