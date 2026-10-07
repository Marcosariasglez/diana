import type { MediaKey } from './rating';

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
  deck?: Array<{ mediaType: 'movie' | 'tv'; mediaId: number }>;
}