/// <reference types="jest" />

// P10 (F4-3): credenciales Supabase ficticias para tests.
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// P10: Mock global de Supabase
jest.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'vertice-diana-auth',
  getSupabase: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithOAuth: jest.fn().mockResolvedValue({ error: null }),
      signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      updateUser: jest.fn().mockResolvedValue({ error: null }),
    },
    rpc: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      unsubscribe: jest.fn(),
    }),
    removeChannel: jest.fn(),
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      insert: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      update: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      delete: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      maybeSingle: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ error: { message: 'mocked' }, data: null }),
    }),
  })),
}));

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));
jest.mock('react-native-gesture-handler', () => {
  const makeGesture = (): any => {
    const g: any = new Proxy({}, { get: () => () => g });
    return g;
  };
  return {
    Gesture: { Pan: makeGesture, Tap: makeGesture },
    GestureDetector: ({ children }: { children: import('react').ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: import('react').ReactNode }) => children,
  };
});
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  getStringsAsync: jest.fn(),
  clearClipboardAsync: jest.fn(),
  hasStringsAsync: jest.fn(),
}));

// ============================================================================
// @/services mock
// ============================================================================
jest.mock('@/services', () => {
  const {
    mockRooms, mockSeq, mockNextCode, mockMe, mockBuildMember,
    mockSubscribers, mockDecisionSubscribers, mockFakeSnap,
    mockNotify, mockEnsureSeededRoom, mockTimers,
  } = require('@/__tests__/__mockRoomState');

  const mockGetFeatured = async (platforms: string[], ctx: unknown) => {
    if (!platforms || platforms.length === 0) return null;
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    if (eligible.length === 0) return null;
    const first = eligible[0];
    // Strip ranking internals (tenths, score, explanation) - only pass media+bucket up
    const { tenths, score, explanation, ...rest } = first;
    return rest;
  };

  const mockGetFeedCategories = async (platforms: string[], ctx: unknown, page: number) => {
    if (!platforms || platforms.length === 0) return { categories: [], hasMore: false };
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    if (eligible.length === 0) return { categories: [], hasMore: false };

    const PAGE_SIZE = 5;
    const bucketMeta: Record<string, { id: string; label: string }> = {
      alto: { id: 'recommendations', label: 'Recomendaciones' },
      medio: { id: 'hidden-gems', label: 'Joyas ocultas' },
      bajo: { id: 'surprises', label: 'Sorpresas' },
    };

    const categories = Object.entries(bucketMeta).map(([bucket, { id, label }]) => {
      const items = eligible.filter((r: any) => r.bucket === bucket);
      const start = page * PAGE_SIZE;
      const pageItems = items.slice(start, start + PAGE_SIZE);
      return { id, label, media: pageItems.map((r: any) => ({ media: r.media })) };
    });

    const hasMore = categories.some((c) => {
      const bucket = Object.entries(bucketMeta).find(([, v]) => v.id === c.id)?.[0];
      if (!bucket) return false;
      const items = eligible.filter((r: any) => r.bucket === bucket);
      return items.length > (page + 1) * PAGE_SIZE;
    });

    return { categories, hasMore };
  };

  const mockGetCategoryItems = async (category: string, platforms: string[], ctx: unknown, page: number) => {
    if (!platforms || platforms.length === 0) return { items: [], hasMore: false };
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);

    let bucket: string;
    if (category === 'recommendations') bucket = 'alto';
    else if (category === 'hidden-gems') bucket = 'medio';
    else bucket = 'bajo';

    const items = eligible.filter((r: any) => r.bucket === bucket);
    const PAGE_SIZE = 5;
    const start = page * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    return { items: pageItems.map((r: any) => ({ media: r.media })), hasMore: items.length > (page + 1) * PAGE_SIZE };
  };

  const mockGetMoodResults = async (input: unknown, ctx: unknown) => {
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const platforms = (input as { platforms: string[] }).platforms;
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    return eligible;
  };

  const mockGetGroupDeck = async ({ excludeKeys, filters, count }: { excludeKeys: Set<string>; filters: { fallbackPlatforms: string[] }; count: number }) => {
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    return FIXTURE_CATALOG.filter((m: any) => {
      if (excludeKeys.has(`${m.media_type}:${m.id}`)) return false;
      if (filters.fallbackPlatforms && filters.fallbackPlatforms.length > 0) {
        return (m.platforms || []).some((p: string) => filters.fallbackPlatforms.includes(p));
      }
      return true;
    }).slice(0, count);
  };

  const mockGetMediaById = async (type: string, id: number) => {
    const { fixtureMedia } = require('@/test/fixtures/catalog');
    return fixtureMedia(type, id) ?? null;
  };

  const mockGetTvSeason = async (id: number, seasonNumber: number) => {
    const { fixtureTvSeason } = require('@/test/fixtures/catalog');
    return fixtureTvSeason(id, seasonNumber) ?? null;
  };

  const mockGetOnboardingDeck = async (platforms: string[]) => {
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    if (!platforms || platforms.length === 0) return [];
    return FIXTURE_CATALOG.filter((m: any) =>
      (m.platforms || []).some((p: string) => platforms.includes(p))
    ).slice(0, 20);
  };

  return {
    profileRepository: {
      load: jest.fn().mockResolvedValue(null),
      saveProfile: jest.fn().mockResolvedValue(undefined),
      saveInitialRating: jest.fn().mockResolvedValue(undefined),
      saveImport: jest.fn().mockResolvedValue(undefined),
      removeEntry: jest.fn().mockResolvedValue(undefined),
    },
    ratingRepository: {
      saveRating: jest.fn(),
      getRating: jest.fn().mockResolvedValue(null),
      getAllRatings: jest.fn().mockResolvedValue([]),
    },
    searchRepository: { search: jest.fn() },
    importRepository: { parseLetterboxd: jest.fn() },
    watchlistRepository: {
      load: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      remove: jest.fn(),
    },
    roomRepository: {
      createRoom: jest.fn().mockImplementation(async (hostId, affinity) => {
        const code = mockNextCode();
        const me = mockMe();
        mockRooms.set(code, {
          code,
          affinity: affinity ?? 'intermedio',
          hostId,
          phase: 'lobby',
          members: [mockBuildMember(hostId, me.name, true, true)],
          mood: { answers: {}, confirmed: false },
          decisions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // Schedule friend joins using MOCK_TIMELINE constants (fakeSocket behavior)
        const timeline = require('@/test/fixtures/room').MOCK_TIMELINE;
        const friends = [
          { userId: 'user-maria', name: 'María', delay: timeline.joinMaria, ready: true },
          { userId: 'user-carlos', name: 'Carlos', delay: timeline.joinCarlos, ready: false },
          { userId: 'user-ana', name: 'Ana', delay: timeline.joinAna, ready: false },
        ];

        friends.forEach(({ userId: uid, name, delay, ready }) => {
          const timer = setTimeout(() => {
            const room = mockRooms.get(code);
            if (!room || room.members.length >= 6) return;
            if (room.members.find((m: any) => m.userId === uid)) return;
            room.members.push(mockBuildMember(uid, name, ready, false));
            room.updatedAt = Date.now();
            mockNotify(code);

            // Carlos joins not-ready; schedule setReady at readyCarlos
            if (uid === 'user-carlos') {
              const readyTimer = setTimeout(() => {
                const r = mockRooms.get(code);
                if (!r) return;
                const mem = r.members.find((m: any) => m.userId === uid);
                if (mem) mem.isReady = true;
                r.updatedAt = Date.now();
                mockNotify(code);
              }, timeline.readyCarlos - timeline.joinCarlos);
              mockTimers.push(readyTimer);
            }
            // Ana joins not-ready; schedule setReady at readyAna
            if (uid === 'user-ana') {
              const readyTimer = setTimeout(() => {
                const r = mockRooms.get(code);
                if (!r) return;
                const mem = r.members.find((m: any) => m.userId === uid);
                if (mem) mem.isReady = true;
                r.updatedAt = Date.now();
                mockNotify(code);
              }, timeline.readyAna - timeline.joinAna);
              mockTimers.push(readyTimer);
            }
          }, delay);
          mockTimers.push(timer);
        });

        return code;
      }),
      joinRoom: jest.fn().mockImplementation(async (code, user) => {
        const upperCode = code.trim().toUpperCase();

        // Ensure X49B seeded room exists
        if (!mockRooms.has(upperCode)) {
          mockEnsureSeededRoom();
        }

        if (!mockRooms.has(upperCode)) {
          const e = new Error('not-found');
          (e as any).code = 'not-found';
          throw e;
        }

        const room = mockRooms.get(upperCode);
        if (!room) {
          const e = new Error('not-found');
          (e as any).code = 'not-found';
          throw e;
        }

        if (room.members.length >= 6) {
          const e = new Error('full');
          (e as any).code = 'full';
          throw e;
        }

        const existing = room.members.find((m: any) => m.userId === user.userId);
        if (existing) return mockFakeSnap(upperCode);

        room.members.push(mockBuildMember(user.userId, user.name, false, false));
        room.updatedAt = Date.now();
        return mockFakeSnap(upperCode);
      }),
      setReady: jest.fn().mockImplementation(async (code, userId, ready) => {
        const room = mockRooms.get(code);
        if (!room) return;
        const member = room.members.find((m: any) => m.userId === userId);
        if (member) member.isReady = ready;
        room.updatedAt = Date.now();
      }),
      startMatch: jest.fn().mockImplementation(async (code, userId) => {
        const room = mockRooms.get(code);
        if (!room) throw new Error('not-found');
        if (room.hostId !== userId) {
          const e = new Error('not-host');
          (e as any).name = 'RoomError';
          (e as any).code = 'not-host';
          throw e;
        }
        room.phase = 'mood';
        room.updatedAt = Date.now();
        mockNotify(code);
      }),
      setMoodAnswer: jest.fn().mockImplementation(async (code, userId, questionId, answerId) => {
        const room = mockRooms.get(code);
        if (!room) return;
        room.mood.answers = { ...room.mood.answers, [questionId]: answerId };
        room.updatedAt = Date.now();
        mockNotify(code);
      }),
      confirmMood: jest.fn().mockImplementation(async (code, userId, deck) => {
        const room = mockRooms.get(code);
        if (!room) return;
        room.phase = 'swipe';
        room.mood.confirmed = true;
        room.updatedAt = Date.now();
        if (deck) room.deck = deck;
        mockNotify(code);
      }),
      submitDecision: jest.fn().mockImplementation(async (code, userId, key, decision) => {
        const room = mockRooms.get(code);
        if (!room) return;
        const existing = room.decisions.find((d: any) => d.userId === userId && d.key === key);
        if (existing) {
          existing.decision = decision;
        } else {
          room.decisions.push({ userId, key, decision });
        }
        room.updatedAt = Date.now();
        mockDecisionSubscribers.get(code)?.forEach((cb: any) => cb({ userId, key, decision }));
      }),
      leaveRoom: jest.fn().mockImplementation((code, userId) => {
        const room = mockRooms.get(code);
        if (!room) return;
        room.members = room.members.filter((m: any) => m.userId !== userId);
        // Clear friend-join timers for this room
        mockTimers.forEach((t) => clearTimeout(t));
        mockTimers.length = 0;
      }),
      backToLobby: jest.fn().mockImplementation(async (code) => {
        const room = mockRooms.get(code);
        if (!room) return;
        room.phase = 'lobby';
        room.mood = { answers: {}, confirmed: false };
        room.decisions = [];
        room.updatedAt = Date.now();
        mockNotify(code);
        return mockFakeSnap(code);
      }),
      subscribe: jest.fn().mockImplementation((code, cb) => {
        if (!mockSubscribers.has(code)) mockSubscribers.set(code, []);
        const subs = mockSubscribers.get(code)!;
        subs.push(cb);
        return () => {
          const idx = subs.indexOf(cb);
          if (idx >= 0) subs.splice(idx, 1);
        };
      }),
      subscribeDecisions: jest.fn().mockImplementation((code, cb) => {
        if (!mockDecisionSubscribers.has(code)) mockDecisionSubscribers.set(code, []);
        const subs = mockDecisionSubscribers.get(code)!;
        subs.push(cb);
        return () => {
          const idx = subs.indexOf(cb);
          if (idx >= 0) subs.splice(idx, 1);
        };
      }),
      getGroupSeenKeys: jest.fn().mockResolvedValue([]),
      beginSwipe: jest.fn(),
    },
    catalogRepository: {
      getOnboardingDeck: jest.fn(mockGetOnboardingDeck),
      getFeatured: jest.fn(mockGetFeatured),
      getFeedCategories: jest.fn(mockGetFeedCategories),
      getCategoryItems: jest.fn(mockGetCategoryItems),
      getMediaById: jest.fn(mockGetMediaById),
      getTvSeason: jest.fn(mockGetTvSeason),
      getMoodResults: jest.fn(mockGetMoodResults),
      getGroupDeck: jest.fn(mockGetGroupDeck),
    },
    GROUP_DECK_SEED: 'group-deck',
    ImportError: class ImportError extends Error {
      readonly code: string;
      constructor(code: string) { super(code); this.name = 'ImportError'; this.code = code; }
    },
    IMPORT_ERROR_MESSAGES: {},
    RoomError: class RoomError extends Error {
      readonly code: string;
      constructor(code: string) { super(code); this.name = 'RoomError'; this.code = code; }
    },
  };
});

// ============================================================================
// @/services/room.repository mock (legacy import path)
// ============================================================================
jest.mock('@/services/room.repository', () => {
  const {
    mockRooms, mockNextCode, mockBuildMember, mockFakeSnap,
    mockResetRooms, mockEnsureSeededRoom,
  } = require('@/__tests__/__mockRoomState');

  const { mockTimers: mockTimersRoomRepo } = require('@/__tests__/__mockRoomState');

  return {
    roomRepository: {
      createRoom: jest.fn().mockImplementation(async (hostId, affinity) => {
        const code = mockNextCode();
        const me = require('@/__tests__/__mockRoomState').mockMe();
        mockRooms.set(code, {
          code,
          affinity: affinity ?? 'intermedio',
          hostId,
          phase: 'lobby',
          members: [mockBuildMember(hostId, me.name, true, true)],
          mood: { answers: {}, confirmed: false },
          decisions: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return code;
      }),
      leaveRoom: jest.fn().mockImplementation((code, userId) => {
        const room = mockRooms.get(code);
        if (!room) return;
        room.members = room.members.filter((m: any) => m.userId !== userId);
        mockTimersRoomRepo.forEach((t: any) => clearTimeout(t));
        mockTimersRoomRepo.length = 0;
      }),
      joinRoom: jest.fn().mockImplementation(async (code, user) => {
        const upperCode = code.trim().toUpperCase();

        if (!mockRooms.has(upperCode)) {
          const seeded = mockEnsureSeededRoom();
          if (!seeded && upperCode !== 'X49B') {
            const e = new Error('not-found');
            (e as any).code = 'not-found';
            throw e;
          }
        }

        const room = mockRooms.get(upperCode);
        if (!room) {
          const e = new Error('not-found');
          (e as any).code = 'not-found';
          throw e;
        }

        if (room.members.length >= 6) {
          const e = new Error('full');
          (e as any).code = 'full';
          throw e;
        }

        const existing = room.members.find((m: any) => m.userId === user.userId);
        if (existing) return mockFakeSnap(upperCode);

        room.members.push(mockBuildMember(user.userId, user.name, false, false));
        room.updatedAt = Date.now();
        return mockFakeSnap(upperCode);
      }),
      setReady: jest.fn().mockResolvedValue(undefined),
      startMatch: jest.fn().mockResolvedValue(undefined),
      setMoodAnswer: jest.fn().mockResolvedValue(undefined),
      confirmMood: jest.fn().mockResolvedValue(undefined),
      submitDecision: jest.fn().mockResolvedValue(undefined),
      backToLobby: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn(),
      subscribeDecisions: jest.fn(),
    },
    resetMockRooms: mockResetRooms,
  };
});

// ============================================================================
// @/services/catalog.repository mock (legacy import path)
// ============================================================================
jest.mock('@/services/catalog.repository', () => {
  const mockGetFeatured = async (platforms: string[], ctx: unknown) => {
    if (!platforms || platforms.length === 0) return null;
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    if (eligible.length === 0) return null;
    return eligible[0];
  };

  const mockGetFeedCategories = async (platforms: string[], ctx: unknown, page: number) => {
    if (!platforms || platforms.length === 0) return { categories: [], hasMore: false };
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    if (eligible.length === 0) return { categories: [], hasMore: false };

    const PAGE_SIZE = 5;
    const bucketMeta: Record<string, { id: string; label: string }> = {
      alto: { id: 'recommendations', label: 'Recomendaciones' },
      medio: { id: 'hidden-gems', label: 'Joyas ocultas' },
      bajo: { id: 'surprises', label: 'Sorpresas' },
    };

    const categories = Object.entries(bucketMeta).map(([bucket, { id, label }]) => {
      const items = eligible.filter((r: any) => r.bucket === bucket);
      const start = page * PAGE_SIZE;
      const pageItems = items.slice(start, start + PAGE_SIZE);
      return { id, label, media: pageItems.map((r: any) => ({ media: r.media })) };
    });

    const hasMore = categories.some((c) => {
      const bucket = Object.entries(bucketMeta).find(([, v]) => v.id === c.id)?.[0];
      if (!bucket) return false;
      const items = eligible.filter((r: any) => r.bucket === bucket);
      return items.length > (page + 1) * PAGE_SIZE;
    });

    return { categories, hasMore };
  };

  const mockGetCategoryItems = async (category: string, platforms: string[], ctx: unknown, page: number) => {
    if (!platforms || platforms.length === 0) return { items: [], hasMore: false };
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);

    let bucket: string;
    if (category === 'recommendations') bucket = 'alto';
    else if (category === 'hidden-gems') bucket = 'medio';
    else bucket = 'bajo';

    const items = eligible.filter((r: any) => r.bucket === bucket);
    const PAGE_SIZE = 5;
    const start = page * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    return { items: pageItems.map((r: any) => ({ media: r.media })), hasMore: items.length > (page + 1) * PAGE_SIZE };
  };

  const mockGetMoodResults = async (input: unknown, ctx: unknown) => {
    const { rankEligible } = require('@/recommender');
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    const platforms = (input as { platforms: string[] }).platforms;
    const eligible = rankEligible(platforms, ctx, FIXTURE_CATALOG);
    return eligible;
  };

  const mockGetGroupDeck = async ({ excludeKeys, filters, count }: { excludeKeys: Set<string>; filters: { fallbackPlatforms: string[] }; count: number }) => {
    const { FIXTURE_CATALOG } = require('@/test/fixtures/catalog');
    return FIXTURE_CATALOG.filter((m: any) => {
      if (excludeKeys.has(`${m.media_type}:${m.id}`)) return false;
      if (filters.fallbackPlatforms && filters.fallbackPlatforms.length > 0) {
        return (m.platforms || []).some((p: string) => filters.fallbackPlatforms.includes(p));
      }
      return true;
    }).slice(0, count);
  };

  return {
    catalogRepository: {
      getOnboardingDeck: jest.fn().mockResolvedValue([]),
      getFeatured: jest.fn(mockGetFeatured),
      getFeedCategories: jest.fn(mockGetFeedCategories),
      getCategoryItems: jest.fn(mockGetCategoryItems),
      getMediaById: jest.fn().mockResolvedValue(null),
      getTvSeason: jest.fn().mockResolvedValue(null),
      getMoodResults: jest.fn(mockGetMoodResults),
      getGroupDeck: jest.fn(mockGetGroupDeck),
    },
  };
});
