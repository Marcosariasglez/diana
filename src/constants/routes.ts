import type { RoomPhase } from '@/types/room';

export interface RouteEntry {
  /** Patron de URL tal como aparece en 5.1. */
  url: string;
  /** Archivo bajo app/ que la implementa. */
  file: string;
  /** Presentacion segun 5.1. */
  presentation: string;
  /** Si la bottom nav esta visible en esa ruta. */
  bottomNav: boolean;
}

/** Manifiesto de rutas (5.1). Fuente unica para tests y para la bottom nav. */
export const ROUTES: ReadonlyArray<RouteEntry> = [
  { url: '/welcome', file: 'app/(onboarding)/welcome.tsx', presentation: 'stack-fade', bottomNav: false },
  {
    url: '/swipe-onboarding',
    file: 'app/(onboarding)/swipe-onboarding.tsx',
    presentation: 'stack-push',
    bottomNav: false,
  },
  { url: '/', file: 'app/(tabs)/index.tsx', presentation: 'tab', bottomNav: true },
  { url: '/mood', file: 'app/(tabs)/mood.tsx', presentation: 'tab', bottomNav: true },
  { url: '/match', file: 'app/(tabs)/match.tsx', presentation: 'tab', bottomNav: true },
  { url: '/profile', file: 'app/(tabs)/profile.tsx', presentation: 'tab', bottomNav: true },
  { url: '/detail/[id]', file: 'app/(tabs)/detail/[id].tsx', presentation: 'tab-hidden', bottomNav: true },
  { url: '/mood-wizard', file: 'app/mood-wizard.tsx', presentation: 'fullScreenModal-fade', bottomNav: false },
  { url: '/mood-results', file: 'app/mood-results.tsx', presentation: 'card', bottomNav: false },
  { url: '/daily-log', file: 'app/daily-log.tsx', presentation: 'modal', bottomNav: false },
  { url: '/notifications', file: 'app/notifications.tsx', presentation: 'card', bottomNav: false },
  { url: '/see-all/[category]', file: 'app/see-all/[category].tsx', presentation: 'card', bottomNav: false },
  { url: '/room/join', file: 'app/room/join.tsx', presentation: 'card', bottomNav: false },
  { url: '/room/[code]', file: 'app/room/[code]/index.tsx', presentation: 'card', bottomNav: false },
  {
    url: '/room/[code]/mood',
    file: 'app/room/[code]/mood.tsx',
    presentation: 'card-no-gesture',
    bottomNav: false,
  },
  {
    url: '/room/[code]/swipe',
    file: 'app/room/[code]/swipe.tsx',
    presentation: 'fullScreenModal-fade',
    bottomNav: false,
  },
  { url: '/login', file: 'app/login.tsx', presentation: 'stack-fade', bottomNav: false },
  { url: '(cualquier otra)', file: 'app/+not-found.tsx', presentation: 'stack', bottomNav: false },
];

/** URL concreta de la pantalla de una fase de sala (5.1 y 6.1). */
export function roomPathForPhase(code: string, phase: RoomPhase): string {
  switch (phase) {
    case 'lobby':
      return `/room/${code}`;
    case 'mood':
      return `/room/${code}/mood`;
    case 'swipe':
      return `/room/${code}/swipe`;
  }
}
