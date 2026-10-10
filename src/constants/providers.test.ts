import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PROVIDERS,
  PROVIDER_BY_ID,
  PROVIDER_BY_TMDB_ID,
  PROVIDER_FILTER,
  PENDING_VERIFICATION,
  ES_PROVIDERS,
} from './providers';
import { PLATFORMS, DEFAULT_PLATFORMS, platformName } from './platforms';

/**
 * VERTICE-PLAN-2 D2-1.1: un único origen de verdad compartido por la app y la
 * Edge Function `tmdb`. Estos tests son la «prueba que los compara»: si alguien
 * edita `providers.ts` (o `platforms.ts`) de forma incoherente, fallan.
 *
 * Los ids TMDB con número provienen del PROVIDER_MAP anterior del repo (evidencia
 * en el código) PERO el conjunto no está verificado contra la API real: no hay
 * `TMDB_READ_TOKEN` en `.env.local`. `scripts/verify-catalog.mjs` lo verifica con
 * la acción `providers` cuando el dueño aporta el token.
 */
describe('providers (único origen de verdad, D2-1.1)', () => {
  it('cada provider tiene id estable, nombre e id TMDB coherente', () => {
    for (const p of PROVIDERS) {
      expect(p.id).toMatch(/^[a-z0-9-]+$/i);
      expect(p.name.length).toBeGreaterThan(0);
      if (p.tmdbProviderId != null) expect(Number.isInteger(p.tmdbProviderId)).toBe(true);
    }
  });

  it('no hay ids duplicados ni ids TMDB duplicados', () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tmdbIds = PROVIDERS.filter((p) => p.tmdbProviderId != null).map((p) => p.tmdbProviderId as number);
    expect(new Set(tmdbIds).size).toBe(tmdbIds.length);
  });

  it('PLATFORMS se deriva de providers (misma lista, mismas plataformas ES)', () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(ES_PROVIDERS.map((p) => p.id));
    for (const p of PLATFORMS) expect(PROVIDER_BY_ID.get(p.id)?.name).toBe(p.name);
  });

  it('PROVIDER_BY_TMDB_ID y el filtro solo contienen proveedores ES verificados', () => {
    for (const [tmdbId, id] of PROVIDER_BY_TMDB_ID) {
      const p = PROVIDER_BY_ID.get(id);
      expect(p).toBeDefined();
      expect(p!.tmdbProviderId).toBe(tmdbId);
    }
    // El filtro usa SOLO ids (TMDB) de proveedores activos en ES y verificados.
    const expected = PROVIDERS.filter((p) => p.es && p.tmdbProviderId != null)
      .map((p) => String(p.tmdbProviderId))
      .join('|');
    expect(PROVIDER_FILTER).toBe(expected);
    expect(PROVIDER_FILTER.length).toBeGreaterThan(0);
  });

  it('los proveedores pendientes de verificación NO están en el filtro (se salta su sync)', () => {
    for (const id of PENDING_VERIFICATION) {
      const p = PROVIDER_BY_ID.get(id)!;
      expect(p.es).toBe(true);
      expect(p.tmdbProviderId).toBeNull();
      expect(PROVIDER_FILTER).not.toContain(p.id);
    }
    // Ids VERIFICADOS en vivo (2026-10-10, /watch/providers ES): si alguno
    // cambia en TMDB, estos tests lo detectan.
    expect(PROVIDER_BY_ID.get('filmin')!.tmdbProviderId).toBe(63);
    expect(PROVIDER_BY_ID.get('mubi')!.tmdbProviderId).toBe(11);
    expect(PROVIDER_BY_ID.get('rtve-play')!.tmdbProviderId).toBe(541);
    expect(PROVIDER_BY_ID.get('prime-video')!.tmdbProviderId).toBe(119);
    expect(PROVIDER_BY_ID.get('max')!.tmdbProviderId).toBe(1899);
    expect(PROVIDER_BY_ID.get('apple-tv')!.tmdbProviderId).toBe(350);
    expect(PROVIDER_BY_ID.get('rakuten-tv')!.tmdbProviderId).toBe(35);
    expect(PROVIDER_BY_ID.get('pluto-tv')!.tmdbProviderId).toBe(300);
    expect(PROVIDER_BY_ID.get('movistar-plus')!.tmdbProviderId).toBe(2241);
    expect(PROVIDER_BY_ID.get('skyshowtime')!.tmdbProviderId).toBe(1773);
    expect(PROVIDER_BY_ID.get('atresplayer')!.tmdbProviderId).toBe(62);
    expect(PROVIDER_BY_ID.get('plex')!.tmdbProviderId).toBe(538);
    expect(PROVIDER_BY_ID.get('youtube')!.tmdbProviderId).toBe(188);
    expect(PROVIDER_BY_ID.get('paramount-plus')!.tmdbProviderId).toBeNull(); // sin presencia ES en TMDB
  });

  it('los proveedores desactualizados (es:false) no entran en el filtro ni en PLATFORMS', () => {
    for (const p of PROVIDERS) {
      if (!p.es) {
        expect(PLATFORMS.map((x) => x.id)).not.toContain(p.id);
        if (p.tmdbProviderId != null) {
          // Se conservan para nombrar datos guardados…
          expect(platformName(p.id)).toBe(p.name);
        }
      }
    }
  });

  it('DEFAULT_PLATFORMS siguen siendo un subconjunto válido de ES', () => {
    for (const id of DEFAULT_PLATFORMS) {
      expect(PROVIDER_BY_ID.get(id)?.es).toBe(true);
    }
  });

  it('platformName resuelve ids antiguos y desconocidos sin fallar', () => {
    expect(platformName('netflix')).toBe('Netflix');
    expect(platformName('mitele')).toBe('Mitele'); // es:false, pero se nombra
    expect(platformName('no-existe')).toBe('no-existe');
  });

  it('la función tmdb importa el origen de verdad (no mantiene una copia del mapa)', () => {
    // Lección plan nocturno: la firma/llamada de un RPC (o aquí, el mapa de
    // proveedores) debe provenir del MISMO fichero que el que usa la app, no de
    // una copia. Si la función vuelve a definir un PROVIDER_MAP propio, puede
    // desincronizarse en silencio de src/constants/providers.ts.
    const fn = readFileSync(
      resolve(__dirname, '../../supabase/functions/tmdb/index.ts'),
      'utf8',
    );
    expect(fn).toContain("from '../../../src/constants/providers.ts'");
    expect(fn).toContain('PROVIDER_BY_TMDB_ID');
    expect(fn).not.toMatch(/const PROVIDER_MAP\s*:\s*Record<number,\s*string>\s*=\s*\{[^}]*8\s*:\s*'netflix'/);
  });
});
