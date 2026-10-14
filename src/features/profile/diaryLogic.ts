import type { HistoryEntry } from '@/types/rating';

/** Solo las entradas que provienen del Diario rápido. */
export function diaryEntries(entries: readonly HistoryEntry[]): HistoryEntry[] {
  return entries
    .filter((e) => e.loggedAt != null)
    .sort((a, b) => {
      const ta = new Date(a.loggedAt!).getTime();
      const tb = new Date(b.loggedAt!).getTime();
      return tb - ta; // desc, estable por loggedAt
    });
}

interface DayGroup {
  label: string;
  entries: HistoryEntry[];
}

/** Agrupa por día local con etiqueta "Hoy", "Ayer" o fecha corta. */
export function groupByDay(
  entries: readonly HistoryEntry[],
  now = new Date(),
): DayGroup[] {
  const todayStart = localDateStart(now);
  const yesterdayStart = localDateStart(new Date(now.getTime() - 86400000));

  const groups = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const d = localDateStart(new Date(entry.loggedAt!));
    const key = d.toISOString();
    const arr = groups.get(key);
    if (arr) arr.push(entry);
    else groups.set(key, [entry]);
  }

  const sorted = Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, entries]) => ({
      label: dayLabel(entries[0].loggedAt!, todayStart, yesterdayStart),
      entries,
    }));

  return sorted;
}

/** Inicio del día local (00:00 en la zona horaria del usuario). */
function localDateStart(d: Date): Date {
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(y, m, day);
}

/** Etiqueta del grupo: "Hoy", "Ayer" o "12 oct 2026". */
function dayLabel(
  loggedAt: string,
  todayStart: Date,
  yesterdayStart: Date,
): string {
  const d = localDateStart(new Date(loggedAt));
  const dIso = d.toISOString();
  if (dIso === todayStart.toISOString()) return 'Hoy';
  if (dIso === yesterdayStart.toISOString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
