import type { AffinityBucket, Media } from '@/types/media';
import type { MediaKey, TasteProfile } from '@/types/rating';
import { clamp, roundDiv } from '@/utils/intMath';
import { noiseBp, tasteScoreBp, type NoiseFn } from './taste';

/** score en bp -> decimos enteros [10, 50]. 3 + 2*s con s = scoreBp/10000, redondeo half-up a decimos. */
export function tenthsFromScoreBp(scoreBp: number): number {
  return clamp(roundDiv(30000 + 2 * scoreBp, 1000), 10, 50);
}

export function predictTenths(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): number {
  return tenthsFromScoreBp(tasteScoreBp(profile, media, key, noise));
}

export function predict(profile: TasteProfile, media: Media, key: MediaKey): number {
  return predictTenths(profile, media, key) / 10;
}

/** Cubo de afinidad sobre decimos enteros ya redondeados. */
export function bucketOfTenths(t: number): AffinityBucket {
  return t >= 40 ? 'alto' : t >= 30 ? 'medio' : 'bajo';
}

/** Cubo de afinidad de un titulo para un perfil. */
export function bucketOf(
  profile: TasteProfile,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): AffinityBucket {
  return bucketOfTenths(predictTenths(profile, media, key, noise));
}
