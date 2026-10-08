/**
 * Sombras VERTICE — Anexo X4.
 *
 * Claro: sombra dual. Oscuro: ninguna sombra ni borde.
 */

import type { ViewStyle } from 'react-native';

/** Sombra canonical de tarjeta/boton/chip (claro). */
const cardShadow = {
  shadowColor: '#141414' as unknown as string,
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.05,
  shadowRadius: 24,
  elevation: 2,
};

/** Sombra de FAB (acc 40%). */
const fabShadow = (acc: string) => ({
  shadowColor: acc as unknown as string,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.4,
  shadowRadius: 20,
  elevation: 8,
});

/** Sombra de hoja inferior. */
const sheetShadow = {
  shadowColor: '#000000' as unknown as string,
  shadowOffset: { width: 0, height: -10 },
  shadowOpacity: 0.2,
  shadowRadius: 40,
  elevation: 16,
};

export const SHADOWS = {
  card: cardShadow,
  fab: fabShadow('#0B7A66'),
  sheet: sheetShadow,
  // Poster: misma sombra que tarjeta
  poster: cardShadow,
  // Boton redondo / chip de filtro
  buttonPrimary: cardShadow,
} as const satisfies Record<string, ViewStyle>;

/**
 * En oscuro no hay sombra. Usa el hook useTheme y no apliques sombras
 * cuando scheme === 'dark'.
 */

/** Halo ring para SlotReveal (backward compat). */
export const HALO_RING = {
  borderWidth: 4,
  borderColor: 'rgba(11,122,102,0.2)',
} as const;
