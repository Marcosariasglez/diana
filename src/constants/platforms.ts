export interface Platform {
  id: string;
  name: string;
}

export const PLATFORMS: ReadonlyArray<Platform> = [
  { id: 'netflix', name: 'Netflix' },
  { id: 'prime-video', name: 'Prime Video' },
  { id: 'max', name: 'Max' },
  { id: 'disney-plus', name: 'Disney+' },
  { id: 'apple-tv', name: 'Apple TV' },
  { id: 'paramount-plus', name: 'Paramount+' },
  { id: 'filmin', name: 'Filmin' },
  { id: 'mubi', name: 'MUBI' },
  { id: 'mitele', name: 'Mitele' },
  { id: 'discovery-plus', name: 'Discovery+' },
  { id: 'britbox', name: 'BritBox' },
  { id: 'pluto-tv', name: 'Pluto TV' },
  { id: 'rtve-play', name: 'RTVE Play' },
  { id: 'starzplay', name: 'Starzplay' },
  { id: 'hbo-es', name: 'HBO ES' },
  { id: 'rakuten-tv', name: 'Rakuten TV' },
  { id: 'nova-play', name: 'Nova Play' },
  { id: 'zee5', name: 'ZEE5' },
  { id: 'hotstar', name: 'Hotstar' },
  { id: 'vidAngel', name: 'VidAngel' },
  { id: 'peacock', name: 'Peacock' },
  { id: 'criterion', name: 'Criterion' },
];

export const DEFAULT_PLATFORMS = ['netflix', 'prime-video', 'max', 'disney-plus'];

export const platformName = (id: string): string =>
  PLATFORMS.find((p) => p.id === id)?.name ?? id;