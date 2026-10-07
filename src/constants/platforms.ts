export interface Platform {
  id: string;
  name: string;
}

export const PLATFORMS: ReadonlyArray<Platform> = [
  { id: 'netflix', name: 'Netflix' },
  { id: 'prime-video', name: 'Prime Video' },
  { id: 'max', name: 'Max' },
  { id: 'disney-plus', name: 'Disney+' },
];

export const DEFAULT_PLATFORMS = ['netflix', 'prime-video', 'max'];

export const platformName = (id: string): string =>
  PLATFORMS.find((p) => p.id === id)?.name ?? id;