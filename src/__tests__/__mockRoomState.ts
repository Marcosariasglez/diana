// Shared mock state for room repository tests.
// Both @/services and @/services/room.repository mocks import this module.
// This ensures that createRoom in one mock is visible to joinRoom in the other.

export interface MockRoomData {
  code: string;
  affinity?: string;
  hostId: string;
  phase: string;
  members: Array<{
    userId: string;
    name: string;
    initial: string;
    isReady: boolean;
    isHost: boolean;
    joinedAt: number;
  }>;
  mood: { answers: Record<string, string>; confirmed: boolean };
  decisions: Array<{ userId: string; key: string; decision: string }>;
  createdAt: number;
  updatedAt: number;
  deck?: Array<{ mediaType: string; mediaId: number }>;
}

export const mockRooms = new Map<string, MockRoomData>();
export const mockSubscribers = new Map<string, Array<(s: unknown) => void>>();
export const mockDecisionSubscribers = new Map<string, Array<(d: unknown) => void>>();

// Base32 characters for room codes (same alphabet as the real system)
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const mockSeq = { n: 8300 };
export const mockTimers: NodeJS.Timeout[] = [];

function clearMockTimers(): void {
  mockTimers.forEach(clearTimeout);
  mockTimers.length = 0;
}

export function mockNextCode(): string {
  const n = ++mockSeq.n;
  // Convert to base32 to get codes like "X49B" instead of "8301"
  let result = '';
  let val = n;
  while (val > 0) {
    result = BASE32[val % BASE32.length] + result;
    val = Math.floor(val / BASE32.length);
  }
  return result.padStart(4, BASE32[0]).slice(-4);
}

export function mockMe(): { id: string; name: string; initial: string } {
  try {
    const ps = require('@/store/useProfileStore');
    const p = ps.useProfileStore.getState().profile;
    return {
      id: p?.id ?? 'user-me',
      name: p?.displayName ?? 'Juan',
      initial: (p?.displayName ?? 'J')[0].toUpperCase(),
    };
  } catch {
    return { id: 'user-me', name: 'Juan', initial: 'J' };
  }
}

export function mockBuildMember(
  userId: string,
  name: string,
  isReady: boolean,
  isHost: boolean,
): MockRoomData['members'][number] {
  return { userId, name, initial: name[0].toUpperCase(), isReady, isHost, joinedAt: Date.now() };
}

export function mockFakeSnap(code: string): MockRoomData | null {
  const room = mockRooms.get(code);
  if (!room) return null;
  // Strip isHost/joinedAt from members to match RoomMember type expectations in tests
  const slimMembers = room.members.map((m) => ({
    userId: m.userId,
    name: m.name,
    initial: m.initial,
    isReady: m.isReady,
  }));
  return {
    code,
    hostId: room.hostId,
    phase: room.phase,
    affinity: room.affinity ?? 'intermedio',
    members: slimMembers as any,
    mood: { ...room.mood },
    decisions: room.decisions,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    deck: room.deck,
  } as MockRoomData;
}

export function mockNotify(code: string): void {
  const snap = mockFakeSnap(code);
  if (snap) mockSubscribers.get(code)?.forEach((cb) => cb(snap));
}

export function mockResetRooms(): void {
  clearMockTimers();
  mockRooms.clear();
  mockSubscribers.clear();
  mockDecisionSubscribers.clear();
}

/** Creates a seeded room X49B if it doesn't exist yet. Returns true if it was created. */
export function mockEnsureSeededRoom(): boolean {
  if (mockRooms.has('X49B')) return false;
  mockRooms.set('X49B', {
    code: 'X49B',
    affinity: 'intermedio',
    hostId: 'user-maria',
    phase: 'lobby',
    members: [
      mockBuildMember('user-maria', 'María', true, true),
      mockBuildMember('user-carlos', 'Carlos', true, false),
    ],
    mood: { answers: {}, confirmed: false },
    decisions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Use timeline constants from test fixtures to stay in sync with tests.
  const {
    seededHostStartDelay,
    hostMoodFirstAnswer,
    hostMoodStep,
    hostMoodConfirmDelay,
  } = require('@/test/fixtures/room').MOCK_TIMELINE;

  // Schedule host to start match after seededHostStartDelay
  setTimeout(() => {
    const r = mockRooms.get('X49B');
    if (!r || r.phase !== 'lobby') return;
    r.phase = 'mood';
    r.updatedAt = Date.now();
    mockNotify('X49B');

    const answers = [
      { q: 'time', a: 'h2' },
      { q: 'energy', a: 'calm' },
      { q: 'company', a: 'friends' },
      { q: 'platforms', a: 'netflix,max' },
    ];
    answers.forEach(({ q, a }, i) => {
      const delay = i === 0 ? hostMoodFirstAnswer : hostMoodStep;
      setTimeout(() => {
        const r2 = mockRooms.get('X49B');
        if (!r2) return;
        r2.mood.answers[q] = a;
        r2.updatedAt = Date.now();
        mockNotify('X49B');

        if (i === answers.length - 1) {
          setTimeout(() => {
            const r3 = mockRooms.get('X49B');
            if (!r3) return;
            r3.phase = 'swipe';
            r3.mood.confirmed = true;
            r3.updatedAt = Date.now();
            mockNotify('X49B');
          }, hostMoodConfirmDelay);
        }
      }, delay);
    });
  }, seededHostStartDelay);

  return true;
}
