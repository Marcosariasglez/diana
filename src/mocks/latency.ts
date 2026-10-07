/** Simula la latencia de red del mock (7.4). */
export const fakeDelay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));
