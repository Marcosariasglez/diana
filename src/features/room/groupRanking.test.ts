import type { Media } from '@/types/media';
import type { GroupDecision } from '@/types/room';
import { synthMovie } from '@/mocks/mock-ai/__tests__/helpers';
import { computeGroupRanking, formatGroupLikes, isGroupComplete } from './groupRanking';

const card = (id: number): { media: Media; key: string } => ({ media: synthMovie(id, [18]), key: `movie:${id}` });
const like = (userId: string, id: number): GroupDecision => ({ userId, key: `movie:${id}`, decision: 'like' });
const skip = (userId: string, id: number): GroupDecision => ({ userId, key: `movie:${id}`, decision: 'skip' });
const M3 = ['a', 'b', 'c'];
const flat = () => 30;

describe('computeGroupRanking', () => {
  it('G1 ordena por likes y excluye las cartas sin likes', () => {
    const deck = [card(1), card(2), card(3)];
    const decisions = [
      like('a', 1), like('b', 1), like('c', 1),
      like('a', 2), like('b', 2), skip('c', 2),
      skip('a', 3), skip('b', 3), skip('c', 3),
    ];
    const r = computeGroupRanking({ deck, decisions, memberIds: M3, userPredictTenths: flat });
    expect(r.map((x) => x.media.id)).toEqual([1, 2]);
    expect(r.map(formatGroupLikes)).toEqual(['Gustó a 3 de 3', 'Gustó a 2 de 3']);
  });

  it('G2 desempata por userPredictTenths descendente', () => {
    const deck = [card(2), card(4)];
    const decisions = [like('a', 2), like('b', 2), like('a', 4), like('b', 4)];
    const tenths = (key: string) => (key === 'movie:4' ? 45 : 30);
    const r = computeGroupRanking({ deck, decisions, memberIds: M3, userPredictTenths: tenths });
    expect(r.map((x) => x.media.id)).toEqual([4, 2]);
  });

  it('G3 desempate final por media.id ascendente', () => {
    const deck = [card(9), card(5), card(7)];
    const decisions = [like('a', 9), like('a', 5), like('a', 7)];
    const r = computeGroupRanking({ deck, decisions, memberIds: M3, userPredictTenths: flat });
    expect(r.map((x) => x.media.id)).toEqual([5, 7, 9]);
  });

  it('G4 limita a 10 por defecto', () => {
    const deck = Array.from({ length: 12 }, (_, i) => card(i + 1));
    const decisions = deck.map((c) => like('a', c.media.id));
    expect(computeGroupRanking({ deck, decisions, memberIds: M3, userPredictTenths: flat })).toHaveLength(10);
    expect(computeGroupRanking({ deck, decisions, memberIds: M3, userPredictTenths: flat, limit: 3 })).toHaveLength(3);
  });

  it('G5 isGroupComplete es false si falta una decision', () => {
    const deck = [card(1), card(2)];
    const decisions = [like('a', 1), like('a', 2), like('b', 1), like('b', 2), like('c', 1)];
    expect(isGroupComplete({ deck, decisions, memberIds: M3 })).toBe(false);
    expect(isGroupComplete({ deck, decisions: [...decisions, skip('c', 2)], memberIds: M3 })).toBe(true);
  });

  it('G6 con 4 miembros el total es 4', () => {
    const deck = [card(1)];
    const r = computeGroupRanking({
      deck,
      decisions: [like('a', 1), like('b', 1)],
      memberIds: ['a', 'b', 'c', 'd'],
      userPredictTenths: flat,
    });
    expect(r[0].total).toBe(4);
    expect(formatGroupLikes(r[0])).toBe('Gustó a 2 de 4');
  });

  it('ignora decisiones de quien no es miembro', () => {
    const r = computeGroupRanking({
      deck: [card(1)],
      decisions: [like('zzz', 1)],
      memberIds: M3,
      userPredictTenths: flat,
    });
    expect(r).toEqual([]);
  });
});
