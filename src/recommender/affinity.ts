// Módulo puro para clasificación de afinidad.
// Evita ciclo: composeFeed no debe importar useFeedStore (que arrastra Supabase).
import type { AffinityBucket, Media } from '@/types/media';
import type { MediaKey, TasteProfile } from '@/types/rating';
import { bucketOfTenths, predictTenths } from './predict';
import type { NoiseFn } from './taste';

/** score del RPC `recommend` ([-1,1], 0 en frío) → cubo de afinidad. */
export function bucketFromScore(score: number): AffinityBucket {
  // Mismos umbrales relativos que bucketOfTenths (alto/medio/bajo) pero sobre
  // un score normalizado: >0.25 alto, >=0 medio, resto bajo.
  return score > 0.25 ? 'alto' : score >= 0 ? 'medio' : 'bajo';
}

/** Cubo de afinidad de un título para un perfil (alias de bucketOf en predict.ts). */
export function affinity(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise?: NoiseFn,
): AffinityBucket {
  return bucketOfTenths(predictTenths(profile, media, key, noise));
}
