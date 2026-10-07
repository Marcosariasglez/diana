import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Movie } from '@/types/media';
import type { MoodFilters } from '@/types/mood';
import type { MediaKey } from '@/types/rating';
import type { RoomMember } from '@/types/room';
import { GROUP_DECK_COUNT } from '@/constants/room';
import { BACKEND } from '@/lib/env';
import { mediaKeyOf } from '@/mocks/data/catalog';
import { FAKE_USERS } from '@/mocks/data/fakeUsers';
import { FAKE_HISTORY } from '@/mocks/data/history';
import { predictTenths } from '@/mocks/mock-ai/predict';
import { catalogRepository, roomRepository } from '@/services';
import { buildSeenKeys, selectSeenKeys } from '@/store/seen';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { selectGroupFilters, useRoomStore } from '@/store/useRoomStore';
import { useTasteProfile } from '@/hooks/useTasteProfile';
import { computeGroupRanking, isGroupComplete, type GroupRankingItem } from './groupRanking';

/** Vistos de todos los miembros: el usuario y, para cada amigo mock presente, sus like/skip e historial. */
export function buildGroupExcludeKeys(
  members: ReadonlyArray<Pick<RoomMember, 'userId'>>,
  userSeen: ReadonlySet<MediaKey>,
): Set<MediaKey> {
  const exclude = new Set<MediaKey>(userSeen);
  for (const m of members) {
    const friend = FAKE_USERS.find((f) => f.userId === m.userId);
    if (!friend) continue;
    const seen = buildSeenKeys({
      initialRatings: friend.initialRatings,
      entries: FAKE_HISTORY[friend.userId] ?? [],
      watched: [],
    });
    seen.forEach((k) => exclude.add(k));
  }
  return exclude;
}

/** Pide el mazo de grupo al catalogo con los filtros del anfitrion tal cual (7.2). */
export function loadGroupDeck(input: {
  members: ReadonlyArray<Pick<RoomMember, 'userId'>>;
  userSeen: ReadonlySet<MediaKey>;
  filters: MoodFilters;
  count?: number;
}): Promise<Movie[]> {
  return catalogRepository.getGroupDeck({
    excludeKeys: buildGroupExcludeKeys(input.members, input.userSeen),
    filters: input.filters,
    count: input.count ?? GROUP_DECK_COUNT,
  });
}

export type GroupSwipeStatus = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Swipe de grupo: carga el mazo, avisa al mock con beginSwipe y expone progreso,
 * espera ("Esperando a {nombres}...") y ranking final.
 */
export function useGroupSwipe() {
  const code = useRoomStore((s) => s.code);
  const members = useRoomStore((s) => s.members);
  const decisions = useRoomStore((s) => s.decisions);
  const userId = useProfileStore((s) => s.profile.id);
  const taste = useTasteProfile();

  const [status, setStatus] = useState<GroupSwipeStatus>('loading');
  const [deck, setDeck] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!code) return;
    const token = `${code}#${attempt}`;
    if (loadedFor.current === token) return;
    loadedFor.current = token;
    let cancelled = false;
    setStatus('loading');
    const room = useRoomStore.getState();
    const filters = selectGroupFilters(room, useProfileStore.getState().profile.favoritePlatforms);
    const userSeen = selectSeenKeys(useProfileStore.getState(), useHistoryStore.getState());
    const load: Promise<Movie[]> =
      BACKEND === 'supabase'
        ? Promise.all(room.deck.map((r) => catalogRepository.getMediaById('movie', r.mediaId))).then((list) =>
            list.filter((m): m is Movie => !!m && m.media_type === 'movie'),
          )
        : loadGroupDeck({ members: room.members, userSeen, filters });
    load
      .then((movies) => {
        if (cancelled) return;
        setDeck(movies);
        setIndex(0);
        setStatus(movies.length === 0 ? 'empty' : 'ready');
        if (movies.length > 0) roomRepository.beginSwipe?.(code, movies);
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
      // Permite recargar si el efecto se reejecuta (modo estricto / remontaje).
      if (loadedFor.current === token) loadedFor.current = null;
    };
  }, [code, attempt]);

  const decide = useCallback(
    (decision: 'like' | 'skip') => {
      if (index >= deck.length) return;
      const key = mediaKeyOf(deck[index]);
      setIndex(index + 1);
      useRoomStore
        .getState()
        .submitDecision(key, decision)
        .catch(() => {});
    },
    [deck, index],
  );

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  const deckEntries = useMemo(() => deck.map((media) => ({ media, key: mediaKeyOf(media) })), [deck]);
  const memberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const finished = status === 'ready' && index >= deck.length;
  const complete = useMemo(
    () => status === 'ready' && isGroupComplete({ deck: deckEntries, decisions, memberIds }),
    [status, deckEntries, decisions, memberIds],
  );

  /** Miembros a los que aun les falta alguna carta (para "Esperando a {nombres}..."). */
  const waitingNames = useMemo(() => {
    if (status !== 'ready') return [];
    const done = new Set(decisions.map((d) => d.userId + '|' + d.key));
    return members
      .filter((m) => m.userId !== userId && !deckEntries.every((c) => done.has(m.userId + '|' + c.key)))
      .map((m) => m.name);
  }, [status, decisions, members, deckEntries, userId]);

  const ranking: GroupRankingItem[] | null = useMemo(() => {
    if (!complete) return null;
    const byKey = new Map(deckEntries.map((c) => [c.key, c.media]));
    return computeGroupRanking({
      deck: deckEntries,
      decisions,
      memberIds,
      userPredictTenths: (key) => {
        const media = byKey.get(key);
        return media ? predictTenths(taste, media, key) : 0;
      },
    });
  }, [complete, deckEntries, decisions, memberIds, taste]);

  return {
    status,
    deck,
    index,
    current: index < deck.length ? deck[index] : null,
    total: deck.length,
    finished,
    isComplete: complete,
    waitingNames,
    ranking,
    decide,
    retry,
  };
}
