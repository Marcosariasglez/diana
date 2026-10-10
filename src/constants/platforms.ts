import { PROVIDER_BY_ID, ES_PROVIDERS } from './providers';

export interface Platform {
  id: string;
  name: string;
}

/**
 * Plataformas de la app (VERTICE-PLAN-2 D2-1.1): se derivan de
 * `./providers` (único origen de verdad). Solo las que operan en España
 * (activas + pendientes de verificar id TMDB): son las que ofrece el selector
 * de plataformas y la sincronización de catálogo.
 *
 * Los ids `es: false` (Mitele, ZEE5, Hotstar, Peacock, Criterion…) NO se
 * muestran en el selector, pero `platformName` sigue sabiendo nombrarlos por si
 * un perfil antiguo los guarda en `favorite_platforms`.
 */
export const PLATFORMS: ReadonlyArray<Platform> = ES_PROVIDERS.map((p) => ({ id: p.id, name: p.name }));

export const DEFAULT_PLATFORMS = ['netflix', 'prime-video', 'max', 'disney-plus'];

export const platformName = (id: string): string => PROVIDER_BY_ID.get(id)?.name ?? id;
