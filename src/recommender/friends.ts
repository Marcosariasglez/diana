import type { Media } from '@/types/media';
import type { MediaKey, TasteProfile } from '@/types/rating';
import { hash32 } from '@/utils/hash';
import type { TestUser } from '@/test/fixtures/users';
import { predictTenths } from './predict';
import { buildTasteProfile, noiseBp, type NoiseFn } from './taste';

/** Umbral en decimos: 3,5 o mas es like. */
export const FRIEND_LIKE_MIN_TENTHS = 35;

/**
 * P6 (F3-1): sin `FAKE_HISTORY` (objeto vacio, misma semantica) ni lookup del
 * catalogo: el gusto del amigo sale de sus `initialRatings` + `initialGenres`
 * (los amigos mock traen ambos campos; los ids son de su propio catalogo).
 */
export function friendTaste(
  friend: Pick<TestUser, 'userId' | 'initialRatings'> & { initialGenres?: Record<number, number[]> },
): TasteProfile {
  return buildTasteProfile(friend.userId, friend.initialRatings, [], friend.initialGenres ?? {});
}

export function decisionFromTenths(tenths: number): 'like' | 'skip' {
  return tenths >= FRIEND_LIKE_MIN_TENTHS ? 'like' : 'skip';
}

export function friendDecision(
  friend: Pick<TestUser, 'userId' | 'initialRatings' | 'initialGenres'>,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
): 'like' | 'skip' {
  return decisionFromTenths(predictTenths(friendTaste(friend), media, key, noise));
}

/** Retardo mock determinista en ms, entre 600 y 2999. */
export function friendDecisionDelayMs(friend: Pick<TestUser, 'userId'>, key: MediaKey): number {
  return 600 + (hash32(friend.userId + '|' + key) % 2400);
}
