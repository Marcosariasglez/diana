// VERTICE-PLAN-2, D2-1.5: barrel del catálogo paginado.
export type { CatalogSource } from './postgrest.repository';
export { postgrestCatalogSource } from './postgrest.repository';
export { mockCatalogSource } from './mock.repository';
export type {
  BrowseParams,
  CatalogRow,
  CatalogSort,
  PageResult,
  SearchParams,
} from './types';
export {
  CANDIDATE_LIMIT_MAX,
  CANDIDATE_LIMIT_MIN,
  DEFAULT_CANDIDATE_LIMIT,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './types';
export { availablePlatforms, mediaToRow, rowToMedia } from './mapper';
export { browseRows, candidatesRows, filterBrowse, filterSearch, searchRows, sortAndPage } from './engine';
export {
  buildBrowseQuery,
  buildCandidatesQuery,
  buildSearchQuery,
  COLUMNS,
  filterToString,
  platformFilter,
  toQueryStrings,
} from './query';
export type { CatalogFilter, PostgRestQuery } from './query';
