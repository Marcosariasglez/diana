import type { MediaKey, MediaRef } from '@/types/rating';

export function buildMediaKey(ref: MediaRef): MediaKey {
  const { mediaType, mediaId, season, episode } = ref;
  if (episode !== undefined && season === undefined) {
    throw new Error('buildMediaKey: episode requiere season');
  }
  let key = `${mediaType}:${mediaId}`;
  if (season !== undefined) key += `:s${season}`;
  if (episode !== undefined) key += `:e${episode}`;
  return key;
}