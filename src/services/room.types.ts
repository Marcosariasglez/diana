// P9 (F4-2): tipos extraídos del repositorio mock room.repository.ts
// antes de borrarlo.
import type { Media, MediaType } from '@/types/media';
import type { GroupDecision, RoomSnapshot } from '@/types/room';
import type { Complexity } from '@/types/mood';
import type { MediaKey } from '@/types/rating';

export interface RoomRepository {
  /** Crea la sala. `affinity` (0012): banco de preguntas del mood de grupo;
   *  por defecto la sala queda 'intermedio' (SQL y mock). */
  createRoom(hostId: string, affinity?: Complexity): Promise<string>;
  /** Lanza RoomError con code 'not-found' | 'full'. Si ya es miembro, devuelve el estado actual. */
  joinRoom(code: string, user: { userId: string; name: string }): Promise<RoomSnapshot>;
  setReady(code: string, userId: string, ready: boolean): Promise<void>;
  startMatch(code: string, userId: string): Promise<void>;
  setMoodAnswer(code: string, userId: string, questionId: string, answerId: string): Promise<void>;
  confirmMood(code: string, userId: string, deck?: Array<{ mediaType: MediaType; mediaId: number }>): Promise<void>;
  submitDecision(code: string, userId: string, key: MediaKey, decision: 'like' | 'skip'): Promise<void>;
  subscribe(code: string, cb: (s: RoomSnapshot) => void): () => void;
  subscribeDecisions(code: string, cb: (d: GroupDecision) => void): () => void;
  /** Solo existe en el repositorio real: clave de vistos del grupo. */
  getGroupSeenKeys?(code: string): Promise<string[]>;
  /** SOLO MOCK: programa las decisiones de los amigos (7.5). */
  beginSwipe?(code: string, deck: Media[]): void;
  /** Anadido (opcional): el miembro sale; libera temporizadores del mock. */
  leaveRoom?(code: string, userId: string): void;
  /** Anadido (opcional): vuelve la sala a la fase lobby ("Volver a la sala"). */
  backToLobby?(code: string): Promise<void>;
}
