// «Dónde verla»: qué se enseña según la fiabilidad del origen. Puro, sin red.

export interface Availability {
  flatrate: string[];
  rent: string[];
  buy: string[];
}

const uniq = (list: readonly string[] | undefined): string[] => [...new Set(list ?? [])];

/**
 * - `reliable` (datos reales de TMDB): se muestran tal cual.
 * - No fiable (catálogo guardado): el sincronizador no distingue alquiler de compra, anota
 *   la plataforma en las dos y ha llegado a poner Netflix o Max en alquiler. Solo se
 *   confía en «suscripción»; alquiler y compra se ocultan hasta tener datos reales.
 */
export function groupAvailability(raw: Availability, reliable: boolean): Availability {
  return {
    flatrate: uniq(raw.flatrate),
    rent: reliable ? uniq(raw.rent) : [],
    buy: reliable ? uniq(raw.buy) : [],
  };
}
