import type { SearchKind, SearchResult } from '@/types/search';
import type { Media, TVSeries } from '@/types/media';
import { PAGE_SIZE } from '@/constants/feed';
import { CATALOG, titleOf } from '@/mocks/data/catalog';
import { fakeDelay } from '@/mocks/latency';
import { normalizeTitle } from '@/utils/normalizeTitle';
import { posterColor } from '@/utils/posterColor';

export interface SearchRepository {
  search(params: {
    query: string;
    kind?: SearchKind;
    page?: number;
  }): Promise<{ results: SearchResult[]; hasMore: boolean }>;
}

/** Capitulos destacados por serie (id de serie -> [temporada, capitulo]); hasta 2 por serie. */
export const MOCK_EPISODE_HIGHLIGHTS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  8: [[1, 3]], // Fallout T1 · E3
  52: [[1, 2]], // Breaking Bad
  53: [[1, 2]], // Stranger Things
  54: [[1, 2]], // The Bear
  55: [[1, 1]], // Chernobyl
  56: [[1, 2]], // The Last of Us
  57: [[1, 1]], // The Mandalorian
  58: [[1, 1]], // Black Mirror
  60: [[1, 1]], // Arcane
};

/** `T1 E3`, `T1 · E3`, `S1E3`, `s1 e3`. */
const EPISODE_PATTERN = /\b[ts]\s*(\d+)\s*[·\-.]?\s*e\s*(\d+)\b/i;

const LABELS = { movie: 'Película', tv: 'Serie', episode: 'Capítulo' } as const;

interface Scored {
  result: SearchResult;
  rank: number;
  popularity: number;
}

function matchRank(normalizedTitle: string, q: string): number | null {
  if (normalizedTitle === q) return 0;
  if (normalizedTitle.startsWith(q)) return 1;
  return normalizedTitle.includes(q) ? 2 : null;
}

const byRankThenPopularity = (a: Scored, b: Scored) => a.rank - b.rank || b.popularity - a.popularity;

function episodeResult(series: TVSeries, seasonNumber: number, episodeNumber: number): SearchResult | null {
  const ep = series.seasons
    .find((s) => s.season_number === seasonNumber)
    ?.episodes.find((e) => e.episode_number === episodeNumber);
  if (!ep) return null;
  return {
    kind: 'episode',
    label: LABELS.episode,
    mediaId: series.id,
    mediaType: 'tv',
    title: `${series.name} T${seasonNumber} · E${episodeNumber}`,
    seriesTitle: series.name,
    seasonNumber,
    episodeNumber,
    posterColor: posterColor(series.id),
  };
}

function baseResult(media: Media): SearchResult {
  return {
    kind: media.media_type,
    label: LABELS[media.media_type],
    mediaId: media.id,
    mediaType: media.media_type,
    title: titleOf(media),
    posterColor: posterColor(media.id),
  };
}

export function searchCatalog(query: string, kind: SearchKind = 'all'): SearchResult[] {
  const episodeMatch = EPISODE_PATTERN.exec(query);
  const textQuery = normalizeTitle(episodeMatch ? query.replace(EPISODE_PATTERN, ' ') : query);
  if (!textQuery) return [];

  const movies: Scored[] = [];
  const series: Scored[] = [];
  const episodes: Scored[] = [];
  for (const media of CATALOG) {
    const rank = matchRank(normalizeTitle(titleOf(media)), textQuery);
    if (rank === null) continue;
    const scored = { result: baseResult(media), rank, popularity: media.popularity };
    if (media.media_type === 'movie') {
      movies.push(scored);
      continue;
    }
    series.push(scored);
    const wanted: Array<readonly [number, number]> = episodeMatch
      ? [[Number(episodeMatch[1]), Number(episodeMatch[2])]]
      : [...(MOCK_EPISODE_HIGHLIGHTS[media.id] ?? [])].slice(0, 2);
    for (const [s, e] of wanted) {
      const result = episodeResult(media, s, e);
      if (result) episodes.push({ result, rank, popularity: media.popularity });
    }
  }

  const sorted = (list: Scored[]) => list.sort(byRankThenPopularity).map((x) => x.result);
  const out: SearchResult[] = [];
  if (kind === 'all' || kind === 'movie') out.push(...sorted(movies));
  if (kind === 'all' || kind === 'tv') out.push(...sorted(series));
  if (kind === 'all' || kind === 'episode') out.push(...sorted(episodes));
  return out;
}

export const searchRepository: SearchRepository = {
  async search({ query, kind = 'all', page = 0 }) {
    await fakeDelay();
    const all = searchCatalog(query, kind);
    const start = page * PAGE_SIZE;
    return { results: all.slice(start, start + PAGE_SIZE), hasMore: start + PAGE_SIZE < all.length };
  },
};
