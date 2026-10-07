import { CATALOG, mediaKeyOf } from '@/mocks/data/catalog';
import { FAKE_USERS, type FakeUser } from '@/mocks/data/fakeUsers';
import { decisionFromTenths, friendDecision, friendDecisionDelayMs } from '../friends';

const decisions = FAKE_USERS.map((f) => CATALOG.map((m) => friendDecision(f, m, mediaKeyOf(m))));

describe('friends', () => {
  it('F1 35 decimos es like', () => expect(decisionFromTenths(35)).toBe('like'));
  it('F2 34 decimos es skip', () => expect(decisionFromTenths(34)).toBe('skip'));

  it('F1/F2 con ruido inyectado sobre un amigo real', () => {
    const friend: FakeUser = { userId: 'user-test', name: 'T', initial: 'T', initialRatings: { 4: 'like' } };
    const media = CATALOG.find((m) => m.id === 4)!;
    // peso Drama = 10000; ruido -7750 da 2250 bp = 35 decimos; -7751 da 34.
    expect(friendDecision(friend, media, 'movie:4', () => -7750)).toBe('like');
    expect(friendDecision(friend, media, 'movie:4', () => -7751)).toBe('skip');
  });

  it('F3 misma entrada, misma decision', () => {
    const friend = FAKE_USERS[0];
    const media = CATALOG[3];
    const key = mediaKeyOf(media);
    expect(friendDecision(friend, media, key)).toBe(friendDecision(friend, media, key));
  });

  it('F4 retardo en [600, 2999] y reproducible', () => {
    for (const friend of FAKE_USERS) {
      for (let i = 1; i <= 100; i++) {
        const key = `movie:${i}`;
        const d = friendDecisionDelayMs(friend, key);
        expect(d).toBeGreaterThanOrEqual(600);
        expect(d).toBeLessThanOrEqual(2999);
        expect(friendDecisionDelayMs(friend, key)).toBe(d);
      }
    }
  });

  it('F5 cada amigo da like entre 25% y 75%', () => {
    decisions.forEach((d, i) => {
      const ratio = d.filter((x) => x === 'like').length / d.length;
      expect(`${FAKE_USERS[i].name}:${ratio >= 0.25 && ratio <= 0.75}`).toBe(`${FAKE_USERS[i].name}:true`);
    });
  });

  it('F6 al menos 3 amigos difieren en al menos 20% de titulos', () => {
    let different = 0;
    for (let i = 0; i < decisions.length; i++) {
      const differs = decisions.some(
        (other, j) =>
          j !== i && decisions[i].filter((x, k) => x !== other[k]).length / CATALOG.length >= 0.2,
      );
      if (differs) different++;
    }
    expect(different).toBeGreaterThanOrEqual(3);
  });
});
