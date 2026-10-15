// P9 (F4-2): tipos extraídos del repositorio mock search.repository.ts
// antes de borrarlo.
import type { SearchKind, SearchResult } from '@/types/search';

export interface SearchRepository {
  search(params: {
    query: string;
    kind?: SearchKind;
    page?: number;
  }): Promise<{ results: SearchResult[]; hasMore: boolean }>;
}
