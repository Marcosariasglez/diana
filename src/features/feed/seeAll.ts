// «Ver todo» de una fila de Inicio: traduce el id de la ruta (/see-all/<id>) a
// qué cargar. Puro, sin red.
import { genreName } from '@/constants/genres';
import { decadeLabel } from '@/recommender/reasons';
import { ROW_CATALOG, decadeRow, genreExploreRow, type RowDefinition } from './rowCatalog';

/** Categorías del feed clásico (se cargan con el recomendador por páginas). */
export type LegacyCategoryId = 'hidden-gems' | 'recommendations';

export type SeeAllTarget =
  | { kind: 'legacy'; id: LegacyCategoryId; title: string }
  | { kind: 'row'; def: RowDefinition; title: string };

const LEGACY_TITLES: Record<LegacyCategoryId, string> = {
  'hidden-gems': 'Joyas ocultas',
  recommendations: 'Recomendaciones',
};

/** `null` si el id no corresponde a ninguna fila conocida. */
export function resolveSeeAll(id: string | undefined): SeeAllTarget | null {
  if (!id) return null;
  if (id === 'hidden-gems' || id === 'recommendations') {
    return { kind: 'legacy', id, title: LEGACY_TITLES[id] };
  }
  const fixed = ROW_CATALOG.find((r) => r.id === id);
  if (fixed) return { kind: 'row', def: fixed, title: fixed.title };
  const genre = /^genre-(\d+)$/.exec(id);
  if (genre) {
    const gid = Number(genre[1]);
    const name = genreName(gid);
    if (name === String(gid)) return null; // genreName devuelve el id si no lo conoce
    return { kind: 'row', def: genreExploreRow(gid, name), title: `Explora: ${name}` };
  }
  const decade = /^decade-(\d{4})$/.exec(id);
  if (decade) {
    const d = Number(decade[1]);
    if (d % 10 !== 0 || d < 1900 || d > 2090) return null;
    const def = decadeRow(d, decadeLabel(d));
    return { kind: 'row', def, title: def.title };
  }
  return null;
}
