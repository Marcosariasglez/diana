/**
 * Errores de sala (P5 · F2-5): sitio real, fuera de `src/mocks/`.
 *
 * `message` y `code` son el mismo código. Los valores coinciden con los que
 * levantan los RPC de sala (migraciones 0004/0012) y el mock
 * (`src/mocks/fakeSocket.ts`, que ahora los importa de aquí hasta que muera en P12).
 */
export type RoomErrorCode = 'not-found' | 'full' | 'not-host' | 'wrong-phase';

/** Error de sala: `message` y `code` son el mismo codigo. */
export class RoomError extends Error {
  readonly code: RoomErrorCode;
  constructor(code: RoomErrorCode) {
    super(code);
    this.name = 'RoomError';
    this.code = code;
  }
}
