// P6: composición pura del feed de Inicio.
// Función 100% pura — sin efectos, sin estado global.

import type { FeedItem, FeedRow, Media, ReasonKind } from '@/types/media';
import type { TasteProfile } from '@/types/rating';
import type { ContentRecommendation } from '@/services/recommender';
import { buildReason, topGenres, pickExploreGenre } from '@/recommender/reasons';
import { bucketFromScore } from '@/recommender/affinity';
import { mainGenreId } from '@/utils/media';
import { ROW_CATALOG, genreExploreRow } from './rowCatalog';

interface ComposeFeedInput {
  /** Recomendaciones del RPC o heurística (ordenadas por score). */
  recs: ContentRecommendation[];
  /** Mapa de enriquecimiento: MediaKey → Media completa. */
  enriched: Map<string, Media>;
  /** Perfil de gusto. */
  taste: TasteProfile;
  /** Década preferida (null si no aplica). */
  eraPref: number | null;
  /** Claves ya vistas (para excluir del feed). */
  seenKeys: ReadonlySet<string>;
}

interface ComposeFeedOutput {
  hero: FeedItem[];
  top10: FeedItem[];
  rows: FeedRow[];
}

/** Construye la clave media_type:id para deduplicación. */
function dedupKey(media: Media): string {
  return `${media.media_type}:${media.id}`;
}

/** Convierte una ContentRecommendation en FeedItem con enriquecimiento y razón. */
function toFeedItem(
  rec: ContentRecommendation,
  enriched: Map<string, Media>,
  taste: TasteProfile,
  eraPref: number | null,
): FeedItem {
  const key = dedupKey(rec.media);
  const full = enriched.get(key) ?? rec.media;
  const genreIds = full.genres.map((g) => g.id);
  let year: number | null = null;

  if (full.media_type === 'movie' && full.release_date) {
    year = Number(full.release_date.slice(0, 4)) || null;
  } else if (full.media_type === 'tv' && full.first_air_date) {
    year = Number(full.first_air_date.slice(0, 4)) || null;
  }

  const reason = buildReason({
    explanation: rec.explanation,
    genreIds,
    year,
    taste,
    eraPref,
  });

  return {
    media: full,
    bucket: bucketFromScore(rec.score),
    explanation: rec.explanation.length > 0 ? rec.explanation : undefined,
    reason,
  };
}

/** Selecciona hasta 5 ítems para el hero maximizando variedad.
 * Trabaja sobre las 20 mejores (por score). */
function pickHero(allItems: FeedItem[], count = 5): FeedItem[] {
  if (allItems.length === 0) return [];

  // Limita a las 20 mejores (por score) como indica el plan
  const candidates = allItems.slice(0, 20);

  const picked: FeedItem[] = [];
  const pickedKeys = new Set<string>();
  const byKind: Record<ReasonKind, number> = { liked: 0, genre: 0, era: 0 };
  const byGenre = new Set<number>();

  // Pasa 1: variedad (máx 2 misma razón, máx 2 mismo género)
  for (const item of candidates) {
    if (picked.length >= count) break;

    const kind = item.reason?.kind;
    const genre = mainGenreId(item.media);

    if (kind && byKind[kind] >= 2) continue;
    if (genre !== undefined && byGenre.has(genre)) continue;

    picked.push(item);
    pickedKeys.add(dedupKey(item.media));
    if (kind) byKind[kind]++;
    if (genre !== undefined) byGenre.add(genre);
  }

  // Pasa 2: rellena sin restricciones (nunca repetir, avanza índice seguro)
  for (const item of candidates) {
    if (picked.length >= count) break;
    const dk = dedupKey(item.media);
    if (pickedKeys.has(dk)) continue;
    picked.push(item);
    pickedKeys.add(dk);
  }

  return picked;
}

/** Genera filas personalizadas agrupadas por razón. */
function buildPersonalizedRows(items: FeedItem[]): FeedRow[] {
  if (items.length === 0) return [];

  // Agrupa por clave de razón
  const groups = new Map<string, FeedItem[]>();

  for (const item of items) {
    let groupId = 'sin-razón';
    if (item.reason?.kind === 'liked' && item.reason.text) {
      groupId = `liked:${item.reason.text}`;
    } else if (item.reason?.kind === 'genre' && item.reason.text) {
      groupId = `genre:${item.reason.text}`;
    } else if (item.reason?.kind === 'era' && item.reason.text) {
      groupId = `era:${item.reason.text}`;
    }

    const group = groups.get(groupId) ?? [];
    group.push(item);
    groups.set(groupId, group);
  }

  const rows: FeedRow[] = [];
  let likedCount = 0;

  // Primero las filas «liked» con ≥ 4 títulos (máx 2)
  for (const [id, group] of groups) {
    if (id.startsWith('liked:') && group.length >= 4 && likedCount < 2) {
      const label = id.slice(6); // quita 'liked:'
      rows.push({
        id: `personalized:${id}`,
        title: label,
        subtitle: 'Basado en tus valoraciones',
        items: group,
        seeAll: null,
      });
      likedCount++;
    }
  }

  // Filas por género (top 2 géneros con más peso)
  for (const [id, group] of groups) {
    if (id.startsWith('genre:') && group.length >= 2) {
      const label = id.slice(6);
      rows.push({
        id: `personalized:${id}`,
        title: label,
        subtitle: 'Por tu gusto personal',
        items: group,
        seeAll: null,
      });
      if (rows.filter((r) => r.id.startsWith('personalized:genre')).length >= 2) break;
    }
  }

  // Filas por época
  for (const [id, group] of groups) {
    if (id.startsWith('era:') && group.length >= 3) {
      const label = id.slice(4);
      rows.push({
        id: `personalized:${id}`,
        title: label,
        subtitle: 'Cine de tu época favorita',
        items: group,
        seeAll: null,
      });
    }
  }

  return rows;
}

export function composeFeed(input: ComposeFeedInput): ComposeFeedOutput {
  const { recs, enriched, taste, eraPref, seenKeys } = input;

  // Filtra los seenKeys
  const validRecs = recs.filter((r) => {
    const key = dedupKey(r.media);
    return !seenKeys.has(key);
  });

  // Convierte a FeedItems
  const allItems: FeedItem[] = validRecs.map((r) =>
    toFeedItem(r, enriched, taste, eraPref)
  );

  // Hero: 5 variados
  const hero = pickHero(allItems, 5);
  const heroKeys = new Set(hero.map((h) => dedupKey(h.media)));

  // Top 10: siguientes mejores sin repetir hero
  const remaining = allItems.filter((item) => !heroKeys.has(dedupKey(item.media)));
  const top10 = remaining.slice(0, 10);
  
  // Resto para filas personalizadas
  const forRows = remaining.slice(10);

  // Filas personalizadas
  const personalizedRows = buildPersonalizedRows(forRows);

  // Filas variadas del catálogo (ROW_CATALOG)
  const variedRows: FeedRow[] = [];

  for (const rowDef of ROW_CATALOG) {
    variedRows.push({
      id: rowDef.id,
      title: rowDef.title,
      items: [], // Se llenan con la consulta al catálogo
      seeAll: rowDef.seeAll ?? null,
    });
  }

  // Género exploratorio
  const favGenres = topGenres(taste, 5);
  const explore = pickExploreGenre(favGenres);
  if (explore) {
    const exploreRow = genreExploreRow(explore.id, explore.name);
    variedRows.push({
      id: exploreRow.id,
      title: exploreRow.title,
      items: [],
      seeAll: exploreRow.seeAll ?? null,
    });
  }

  // Alterna personalizada / variada
  const rows: FeedRow[] = [];
  let pi = 0, vi = 0;
  let usePersonalized = true;

  while (pi < personalizedRows.length || vi < variedRows.length) {
    if (usePersonalized && pi < personalizedRows.length) {
      rows.push(personalizedRows[pi++]);
    } else if (vi < variedRows.length) {
      rows.push(variedRows[vi++]);
    } else {
      rows.push(personalizedRows[pi++]);
    }
    usePersonalized = !usePersonalized;
  }

  return { hero, top10, rows };
}
