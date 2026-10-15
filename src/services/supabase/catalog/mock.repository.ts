// VERTICE-PLAN-2, D2-1.5: fuente de candidatos MOCK (memoria) para el
// catálogo paginado. Usa el MISMO motor puro (engine.ts) que el repo
// PostgREST, sobre una lista de filas `catalog_titles` que se carga desde el
// catálogo de mocks (mediaToRow). Así el feed/mood/grupo se prueban igual en
// los dos modos y la semántica (filtros, orden, paginación, «disponible en mis
// plataformas») es idéntica.
import type { Media } from '@/types/media';
import { FIXTURE_CATALOG } from '@/test/fixtures/catalog';
import { mediaToRow, rowToMedia } from './mapper';
import { browseRows, candidatesRows, countRows, searchRows } from './engine';
import type { CatalogSource, RuntimeRange } from './postgrest.repository';
import type { BrowseParams, CatalogRow, CountParams, PageResult, SearchParams } from './types';

let rows: CatalogRow[] | null = null;
function allRows(): CatalogRow[] {
  if (!rows) rows = FIXTURE_CATALOG.map(mediaToRow);
  return rows;
}

function media(page: PageResult<CatalogRow>): PageResult<Media> {
  return { items: page.items.map(rowToMedia), nextCursor: page.nextCursor, hasMore: page.hasMore };
}

export const mockCatalogSource: CatalogSource = {
  async browse(p: BrowseParams): Promise<PageResult<Media>> {
    return media(browseRows(allRows(), p));
  },
  async search(p: SearchParams): Promise<PageResult<Media>> {
    return media(searchRows(allRows(), p));
  },
  async count(p: CountParams): Promise<number | null> {
    return countRows(allRows(), p);
  },
  async byIds(type: 'movie' | 'tv', ids: number[]): Promise<Media[]> {
    const wanted = new Set(ids);
    return allRows()
      .filter((r) => r.media_type === type && wanted.has(r.tmdb_id))
      .map(rowToMedia);
  },
  async candidates(platforms: string[], type?: 'movie' | 'tv', limit?: number, runtime?: RuntimeRange): Promise<Media[]> {
    return candidatesRows(allRows(), platforms, type, limit, runtime).map(rowToMedia);
  },
  async availableNow(platforms: string[]): Promise<Media[]> {
    return candidatesRows(allRows(), platforms, undefined, 1000, undefined).map(rowToMedia);
  },
  async availability(type: 'movie' | 'tv', id: number): Promise<CatalogRow | null> {
    return allRows().find((r) => r.media_type === type && r.tmdb_id === id) ?? null;
  },
};
