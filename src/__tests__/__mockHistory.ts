import type { HistoryEntry } from '@/types/rating';

/** Historial mock de los amigos por userId. Vacio: los amigos solo tienen initialRatings. */
export const FAKE_HISTORY: Record<string, HistoryEntry[]> = {};

/** Historial inicial mock del usuario actual: vacio. */
export const MOCK_HISTORY: ReadonlyArray<HistoryEntry> = [];
