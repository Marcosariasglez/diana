import type { Media } from '@/types/media';
import type { GroupDecision } from '@/types/room';
import type { MediaKey } from '@/types/rating';

export interface GroupRankingItem {
  media: Media;
  key: MediaKey;
  likes: number;
  total: number;
}

export const GROUP_RANKING_LIMIT = 10;

export function computeGroupRanking(input: {
  deck: ReadonlyArray<{ media: Media; key: MediaKey }>;
  decisions: ReadonlyArray<GroupDecision>;
  memberIds: ReadonlyArray<string>;
  userPredictTenths: (key: MediaKey) => number;
  limit?: number;
}): GroupRankingItem[] {
  const members = new Set(input.memberIds);
  const total = input.memberIds.length;
  // Una decision por (miembro, carta); la ultima gana.
  const latest = new Map<string, 'like' | 'skip'>();
  for (const d of input.decisions) {
    if (members.has(d.userId)) latest.set(d.userId + '|' + d.key, d.decision);
  }
  const items: Array<GroupRankingItem & { tenths: number }> = [];
  for (const { media, key } of input.deck) {
    let likes = 0;
    for (const id of members) if (latest.get(id + '|' + key) === 'like') likes++;
    if (likes >= 1) items.push({ media, key, likes, total, tenths: input.userPredictTenths(key) });
  }
  items.sort((a, b) => b.likes - a.likes || b.tenths - a.tenths || a.media.id - b.media.id);
  return items
    .slice(0, input.limit ?? GROUP_RANKING_LIMIT)
    .map(({ media, key, likes, total: t }) => ({ media, key, likes, total: t }));
}

/** true cuando todos los miembros han decidido todas las cartas del mazo. */
export function isGroupComplete(input: {
  deck: ReadonlyArray<{ key: MediaKey }>;
  decisions: ReadonlyArray<GroupDecision>;
  memberIds: ReadonlyArray<string>;
}): boolean {
  const done = new Set(input.decisions.map((d) => d.userId + '|' + d.key));
  return input.memberIds.every((id) => input.deck.every((c) => done.has(id + '|' + c.key)));
}

export function formatGroupLikes(item: Pick<GroupRankingItem, 'likes' | 'total'>): string {
  return `Gustó a ${item.likes} de ${item.total}`;
}
