import { useCallback, useEffect, useRef, useState } from 'react';
import { ONBOARDING_COUNT } from '@/constants/onboarding';
import type { SwipeDir } from '@/features/swipe/direction';
import { catalogRepository } from '@/services';
import { useProfileStore } from '@/store/useProfileStore';
import type { Movie } from '@/types/media';

export type OnboardingSwipeStatus = 'loading' | 'ready' | 'error';

export interface OnboardingSwipe {
  status: OnboardingSwipeStatus;
  /** Cartas pendientes; la primera es la de arriba. */
  cards: Movie[];
  /** Decisiones ya tomadas. */
  decided: number;
  total: number;
  decide: (media: { id: number }, dir: SwipeDir) => void;
  retry: () => void;
}

/** Mazo de onboarding (O2): carga 20 peliculas y registra cada decision como valoracion inicial. */
export function useOnboardingSwipe(): OnboardingSwipe {
  const addInitialRating = useProfileStore((s) => s.addInitialRating);
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);
  const [status, setStatus] = useState<OnboardingSwipeStatus>('loading');
  const [cards, setCards] = useState<Movie[]>([]);
  const [decided, setDecided] = useState(0);
  const [total, setTotal] = useState(ONBOARDING_COUNT);
  const alive = useRef(true);
  const requestId = useRef(0);
  const remaining = useRef(0);
  const finished = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setStatus('loading');
    try {
      const deck = await catalogRepository.getOnboardingDeck(ONBOARDING_COUNT);
      if (!alive.current || id !== requestId.current) return;
      if (deck.length === 0) {
        setStatus('error');
        return;
      }
      remaining.current = deck.length;
      finished.current = false;
      setCards(deck);
      setTotal(deck.length);
      setDecided(0);
      setStatus('ready');
    } catch {
      if (alive.current && id === requestId.current) setStatus('error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const decide = useCallback(
    (media: { id: number }, dir: SwipeDir) => {
      if (finished.current) return;
      addInitialRating(media.id, dir);
      remaining.current -= 1;
      setCards((c) => c.filter((m) => m.id !== media.id));
      setDecided((n) => n + 1);
      if (remaining.current <= 0) {
        finished.current = true;
        completeOnboarding();
      }
    },
    [addInitialRating, completeOnboarding],
  );

  return { status, cards, decided, total, decide, retry: () => void load() };
}
