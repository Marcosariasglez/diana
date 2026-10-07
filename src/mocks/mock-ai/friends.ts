import type { Media } from '@/types/media';
import type { MediaKey, TasteProfile } from '@/types/rating';
import { hash32 } from '@/utils/hash';
import type { FakeUser } from '@/mocks/data/fakeUsers';
import { FAKE_HISTORY } from '@/mocks/data/history';
import { predictTenths } from './predict';
import { buildTasteProfile, noiseBp, type MediaLookup, type NoiseFn } from './taste';

/** Umbral en decimos: 3,5 o mas es like. */
export const FRIEND_LIKE_MIN_TENTHS = 35;

export function friendTaste(friend: FakeUser, lookup?: MediaLookup): TasteProfile {
  return buildTasteProfile(friend.userId, friend.initialRatings, FAKE_HISTORY[friend.userId] ?? [], lookup);
}

export function decisionFromTenths(tenths: number): 'like' | 'skip' {
  return tenths >= FRIEND_LIKE_MIN_TENTHS ? 'like' : 'skip';
}

export function friendDecision(
  friend: FakeUser,
  media: Media,
  key: MediaKey,
  noise: NoiseFn = noiseBp,
  lookup?: MediaLookup,
): 'like' | 'skip' {
  return decisionFromTenths(predictTenths(friendTaste(friend, lookup), media, key, noise));
}

/** Retardo mock determinista en ms, entre 600 y 2999. */
export function friendDecisionDelayMs(friend: Pick<FakeUser, 'userId'>, key: MediaKey): number {
  return 600 + (hash32(friend.userId + '|' + key) % 2400);
}
