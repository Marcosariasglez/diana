import type { Media, MediaType } from '@/types/media';
import type { MediaKey } from '@/types/rating';

const index = new Map<MediaKey, number[]>();

export const registerGenres = (key: MediaKey, ids: number[]): void => void index.set(key, ids);
export const clearGenres = (): void => index.clear();

/** MediaLookup (src/mocks/mock-ai/taste.ts) que solo conoce los generos registrados. */
export function genreLookup(type: MediaType, id: number): Media | undefined {
  const ids = index.get(`${type}:${id}`);
  if (!ids) return undefined;
  return { id, media_type: type, genres: ids.map((g) => ({ id: g, name: '' })) } as unknown as Media;
}
