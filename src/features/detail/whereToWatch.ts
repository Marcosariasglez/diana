// «Dónde verla»: agrupa la disponibilidad por modalidad sin contradicciones.
// Puro, sin red.

export interface Availability {
  flatrate: string[];
  rent: string[];
  buy: string[];
}

export interface GroupedAvailability extends Availability {
  /** Plataformas en alquiler Y compra cuando el origen no distingue una de otra. */
  rentOrBuy: string[];
}

const uniq = (list: readonly string[] | undefined): string[] => [...new Set(list ?? [])];

/**
 * - `reliable` (datos reales de TMDB): se muestran tal cual, sin duplicados dentro de cada fila.
 * - No fiable (catálogo guardado): el sincronizador no distingue alquiler de compra y
 *   anota la plataforma en las dos. Esas coincidencias se muestran UNA vez, como
 *   «Alquiler o compra», en lugar de afirmar que está en las dos cosas.
 */
export function groupAvailability(raw: Availability, reliable: boolean): GroupedAvailability {
  const flatrate = uniq(raw.flatrate);
  const rent = uniq(raw.rent);
  const buy = uniq(raw.buy);
  if (reliable) return { flatrate, rent, buy, rentOrBuy: [] };
  const both = rent.filter((p) => buy.includes(p));
  return {
    flatrate,
    rent: rent.filter((p) => !both.includes(p)),
    buy: buy.filter((p) => !both.includes(p)),
    rentOrBuy: both,
  };
}
