/** Los fallos de escritura al servidor no bloquean la app (B-D9): se registran y ya. */
export function reportSyncError(e: unknown): void {
  console.warn('[sync]', e);
}
