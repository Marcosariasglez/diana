import { FIXTURE_CATALOG } from '@/test/fixtures/catalog';
import { mediaKeyOf } from '@/utils/media';
import { TEST_USERS, type TestUser } from '@/test/fixtures/users';
import { decisionFromTenths, friendDecision, friendDecisionDelayMs } from '../friends';

const decisions = TEST_USERS.map((f) => FIXTURE_CATALOG.map((m) => friendDecision(f, m, mediaKeyOf(m))));

describe('friends', () => {
  it('F1 35 decimos es like', () => expect(decisionFromTenths(35)).toBe('like'));
  it('F2 34 decimos es skip', () => expect(decisionFromTenths(34)).toBe('skip'));

  it('F1/F2 con ruido inyectado sobre un amigo real', () => {
    // P6: el gusto del amigo sale de initialRatings + initialGenres (peli 4 = Drama).
    const friend: TestUser = {
      userId: 'user-test',
      name: 'T',
      initial: 'T',
      initialRatings: { 4: 'like' },
      initialGenres: { 4: [18] },
    };
    const media = FIXTURE_CATALOG.find((m) => m.id === 4)!;
    // peso Drama = 10000; ruido -7750 da 2250 bp = 35 decimos; -7751 da 34.
    expect(friendDecision(friend, media, 'movie:4', () => -7750)).toBe('like');
    expect(friendDecision(friend, media, 'movie:4', () => -7751)).toBe('skip');
  });

  it('F3 misma entrada, misma decision', () => {
    const friend = TEST_USERS[0];
    const media = FIXTURE_CATALOG[3];
    const key = mediaKeyOf(media);
    expect(friendDecision(friend, media, key)).toBe(friendDecision(friend, media, key));
  });

  it('F4 retardo en [600, 2999] y reproducible', () => {
    for (const friend of TEST_USERS) {
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
      expect(`${TEST_USERS[i].name}:${ratio >= 0.25 && ratio <= 0.75}`).toBe(`${TEST_USERS[i].name}:true`);
    });
  });

  it('F6 al menos 3 amigos difieren en al menos 20% de titulos', () => {
    let different = 0;
    for (let i = 0; i < decisions.length; i++) {
      const differs = decisions.some(
        (other, j) =>
          j !== i && decisions[i].filter((x, k) => x !== other[k]).length / FIXTURE_CATALOG.length >= 0.2,
      );
      if (differs) different++;
    }
    expect(different).toBeGreaterThanOrEqual(3);
  });
});
