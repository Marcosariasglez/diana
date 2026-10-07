import type { AffinityBucket, FeedCategory, Media, MediaWithAffinity } from '@/types/media';
import type { MediaKey, RankingContext } from '@/types/rating';
import { HIDDEN_GEM_MAX_VOTES, PAGE_SIZE } from '@/constants/feed';
import { CATALOG, mediaKeyOf } from '@/mocks/data/catalog';
import { bucketOfTenths, predictTenths } from './predict';
import { noiseBp, type NoiseFn } from './taste';

export interface RankedItem {
  media: Media;
  key: MediaKey;
  tenths: number;
  bucket: AffinityBucket;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

/** Paginacion de PAGE_SIZE elementos. `page` empieza en 0. */
export function paginate<T>(items: ReadonlyArray<T>, page: number, size: number = PAGE_SIZE): Page<T> {
  const start = page * size;
  return { items: items.slice(start, start + size), hasMore: start + size < items.length };
}

/**
 * Elegibles: con alguna plataforma del filtro global y no vistos.
 * Orden: predictTenths descendente, desempate por id ascendente.
 */
export function rankEligible(
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): RankedItem[] {
  const out: RankedItem[] = [];
  for (const media of catalog) {
    if (!media.platforms.some((p) => platforms.includes(p))) continue;
    const key = mediaKeyOf(media);
    if (ctx.seenKeys.has(key)) continue;
    const tenths = predictTenths(ctx.taste, media, key, noise);
    out.push({ media, key, tenths, bucket: bucketOfTenths(tenths) });
  }
  return out.sort((a, b) => b.tenths - a.tenths || a.media.id - b.media.id);
}

const toAffinity = (r: RankedItem): MediaWithAffinity => ({ media: r.media, bucket: r.bucket });

/** Destacado ("Recomendacion Top"): el elegible con mayor predictTenths. */
export function pickFeatured(
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): MediaWithAffinity | null {
  const top = rankEligible(platforms, ctx, catalog, noise)[0];
  return top ? toAffinity(top) : null;
}

/** Recomendaciones: elegibles ordenados por afinidad, sin el destacado. */
export function pickRecommendations(
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  page: number,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): Page<MediaWithAffinity> {
  const ranked = rankEligible(platforms, ctx, catalog, noise).slice(1);
  const { items, hasMore } = paginate(ranked, page);
  return { items: items.map(toAffinity), hasMore };
}

/** Joyas ocultas: bucket alto y vote_count <= HIDDEN_GEM_MAX_VOTES. */
export function pickHiddenGems(
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  page: number,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): Page<MediaWithAffinity> {
  const gems = rankEligible(platforms, ctx, catalog, noise).filter(
    (r) => r.bucket === 'alto' && r.media.vote_count <= HIDDEN_GEM_MAX_VOTES,
  );
  const { items, hasMore } = paginate(gems, page);
  return { items: items.map(toAffinity), hasMore };
}

export function pickCategoryItems(
  category: FeedCategory['id'],
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  page: number,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): Page<MediaWithAffinity> {
  return category === 'hidden-gems'
    ? pickHiddenGems(platforms, ctx, page, catalog, noise)
    : pickRecommendations(platforms, ctx, page, catalog, noise);
}

export const HIDDEN_GEMS_TITLE = 'Joyas ocultas';
export const RECOMMENDATIONS_TITLE = 'Recomendaciones para ti';

/** Pagina del feed: categorias vacias se omiten; hasMore si alguna tiene mas paginas. */
export function pickFeedPage(
  platforms: ReadonlyArray<string>,
  ctx: RankingContext,
  page: number,
  catalog: ReadonlyArray<Media> = CATALOG,
  noise: NoiseFn = noiseBp,
): { categories: FeedCategory[]; hasMore: boolean } {
  const gems = pickHiddenGems(platforms, ctx, page, catalog, noise);
  const recs = pickRecommendations(platforms, ctx, page, catalog, noise);
  const categories: FeedCategory[] = [];
  if (gems.items.length > 0) {
    categories.push({ id: 'hidden-gems', title: HIDDEN_GEMS_TITLE, media: gems.items, hasSeeAll: gems.hasMore });
  }
  if (recs.items.length > 0) {
    categories.push({
      id: 'recommendations',
      title: RECOMMENDATIONS_TITLE,
      media: recs.items,
      hasSeeAll: recs.hasMore,
    });
  }
  return { categories, hasMore: gems.hasMore || recs.hasMore };
}
