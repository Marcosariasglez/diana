import type { MediaKey } from './rating';
import type { Complexity } from './mood';

export type RoomPhase = 'lobby' | 'mood' | 'swipe';

export interface RoomMember {
  userId: string;
  name: string;
  initial: string;
  isReady: boolean;
}

export interface GroupMoodState {
  answers: Record<string, string>;
  confirmed: boolean;
}

export interface GroupDecision {
  userId: string;
  key: MediaKey;
  decision: 'like' | 'skip';
}

export interface RoomSnapshot {
  hostId: string;
  members: RoomMember[];
  phase: RoomPhase;
  mood: GroupMoodState;
  /** Afinidad de la sala (banco de preguntas del mood). Default 'intermedio'
   *  (salas antiguas y clientes que no la pasan; migración 0012). */
  affinity?: Complexity;
  deck?: Array<{ mediaType: 'movie' | 'tv'; mediaId: number }>;
}