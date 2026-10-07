export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const t = Math.round(value * 10);
  return `${Math.trunc(t / 10)},${Math.abs(t % 10)}`;
}

export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}