import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Movie } from '@/types/media';
import { predictTenths } from '@/recommender/predict';
import { mediaKeyOf } from '@/utils/media';
import { catalogRepository, roomRepository } from '@/services';
import { useProfileStore } from '@/store/useProfileStore';
import { useRoomStore } from '@/store/useRoomStore';
import { useTasteProfile } from '@/hooks/useTasteProfile';
import { computeGroupRanking, isGroupComplete, type GroupRankingItem } from './groupRanking';

export type GroupSwipeStatus = 'loading' | 'ready' | 'empty' | 'error';

/**
 * Swipe de grupo: el mazo SIEMPRE sale de `room.deck` servido por el backend
 * (lo fija el anfitrión en `confirmMood`, 7.2); sin ramas de datos fake (P5).
 * Si el mazo llega vacío la UI muestra el estado vacío (F2-5).
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
    // El mazo de grupo SIEMPRE lo sirve el backend en `room.deck` (P5 · F2-5):
    // sin rama local con usuarios/historiales fake; vacío → estado vacío en la UI.
    const load: Promise<Movie[]> = Promise.all(
      room.deck.map((r) => catalogRepository.getMediaById('movie', r.mediaId)),
    ).then((list) => list.filter((m): m is Movie => !!m && m.media_type === 'movie'));
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
