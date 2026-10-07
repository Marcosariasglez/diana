import { CATALOG } from '@/lib/env';
import { catalogRepository as mockCatalogRepository } from './catalog.repository';
import { tmdbCatalogRepository } from './tmdb/catalog.repository';

export const activeCatalogRepository = CATALOG === 'tmdb' ? tmdbCatalogRepository : mockCatalogRepository;
