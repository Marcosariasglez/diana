// VERTICE-PLAN-2, D2-1.5: elección de la fuente de candidatos del catálogo.
// Se clavea por el MODO CATALOG (no por BACKEND):
//   - CATALOG=tmdb  → postgrest (lee catalog_titles; exige BACKEND=supabase).
//   - CATALOG=mock  → mock (memoria, mismo motor puro).
// Así la pantalla «Explorar por plataforma» y el motor mood/feed/grupo usan
// la misma fuente que el resto del catálogo, sin importar el backend de perfil.
import { CATALOG } from '@/lib/env';
import { postgrestCatalogSource, type CatalogSource } from './postgrest.repository';
import { mockCatalogSource } from './mock.repository';

export const activeCatalogSource: CatalogSource =
  CATALOG === 'tmdb' ? postgrestCatalogSource : mockCatalogSource;
