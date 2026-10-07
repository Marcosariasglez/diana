import type { SearchResult } from '@/types/search';
import type { SearchRepository } from '../search.repository';
import { posterColor } from '@/utils/posterColor';
import { invokeTmdb } from './invoke';

type Raw = Omit<SearchResult, 'posterColor'> & { poster_path: string | null };

export const tmdbSearchRepository: SearchRepository = {
  async search({ query, kind = 'all', page = 0 }) {
    const res = await invokeTmdb<{ results: Raw[]; hasMore: boolean }>({ action: 'search', query, kind, page: page + 1 });
    return {
      results: res.results.map(({ poster_path: _p, ...r }) => ({ ...r, posterColor: posterColor(r.mediaId) })),
      hasMore: res.hasMore,
    };
  },
};
