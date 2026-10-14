// searchKinds.ts — Lógica pura de filtrado de cortos y documentales para la acción "search".
// Sin imports de Deno: se prueba con Jest como catalog-sync.test.ts.
// Documental = género 99 en genre_ids. Corto = película con 0 < runtime ≤ 40.

// deno-lint-ignore no-explicit-any
type Any = any;

/** Comprobar si un hit de search/multi es documental (genre_ids incluye 99). */
export function isDocumentary(hit: Any): boolean {
  return (hit.genre_ids ?? []).includes(99);
}

/** Filtrar hits de /search/multi para documentales (movie o tv con género 99). */
export function filterDocumentaries(hits: Any[]): Any[] {
  return hits.filter((h: Any) => (h.media_type === 'movie' || h.media_type === 'tv') && isDocumentary(h));
}

/**
 * Dado un conjunto de películas (media_type === 'movie'), quedarse solo con las cortas
 * (0 < runtime ≤ 40). Recibe un mapa id → runtime calculado por el caller.
 */
export function filterShorts(movieHits: Any[], runtimeMap: Map<number, number>): Any[] {
  return movieHits.filter((h: Any) => {
    const rt = runtimeMap.get(h.id);
    return rt !== undefined && rt > 0 && rt <= 40;
  });
}

/**
 * Etiquetar resultados con tag: 'Documental' cuando genre_ids incluye 99.
 * (No se puede determinar 'Corto' sin pedir detalle, así que solo documental aquí.)
 */
export function tagDocumentaryInResults(results: Any[]): void {
  for (const r of results) {
    if ((r.genre_ids ?? []).includes(99)) {
      r.tag = 'Documental';
    }
  }
}
