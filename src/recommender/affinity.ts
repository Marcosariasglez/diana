import type { AffinityBucket, Media, MediaWithAffinity } from '@/types/media';
import type { MediaKey, TasteProfile } from '@/types/rating';
import { noiseBp, type NoiseFn } from './taste';
import { bucketOf } from './predict';

/** Afinidad = bucket de la prediccion ya redondeada. */
export function affinity(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): AffinityBucket {
  return bucketOf(profile, media, key, noise);
}

export function withAffinity(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): MediaWithAffinity {
  return { media, bucket: affinity(profile, media, key, noise) };
}
