// VERTICE-PLAN-2, D2-1.5 / F4-3: fuente de candidatos del catálogo.
// Siempre PostgREST (lee catalog_titles). El mock se eliminó en P10.
import { postgrestCatalogSource, type CatalogSource } from './postgrest.repository';

export const activeCatalogSource: CatalogSource = postgrestCatalogSource;
