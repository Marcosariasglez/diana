import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';

/**
 * VERTICE-PLAN-2 D2-1.7: atribución obligatoria de TMDB (sus condiciones de uso).
 * Texto exacto requerido: «Este producto usa la API de TMDB pero no está avalado
 * ni certificado por TMDB». Se muestra en el pie de Perfil/Cuenta y en las
 * páginas legales. El logotipo se dibuja como wordmark tipográfico (la marca
 * «TMDB»); si el dueño quiere el PNG oficial, basta sustituir <TmdbWordmark/>
 * por un <Image> de assets/ (TMDB exige la atribución, no el logotipo concreto).
 */
export const TMDB_ATTRIBUTION_TEXT =
  'Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.';
export const JUSTWATCH_ATTRIBUTION_TEXT = 'Datos de disponibilidad por JustWatch.';

/** Wordmark tipográfico de TMDB (sustituible por el PNG oficial). */
export function TmdbWordmark() {
  const { colors } = useTheme();
  return (
    <View
      style={[wordmarkStyles.box, { backgroundColor: colors.ink, borderRadius: 4 }]}
      accessibilityLabel="TMDB"
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[wordmarkStyles.text, { color: colors.card }]}>TMDB</Text>
    </View>
  );
}

const wordmarkStyles = StyleSheet.create({
  box: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 10,
    fontFamily: 'Manrope-ExtraBold',
    letterSpacing: 0.5,
  },
});

/** Bloque completo de atribución TMDB (wordmark + texto) para pies de pantalla. */
export function TmdbAttribution() {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6, alignItems: 'center' }} accessibilityLabel={TMDB_ATTRIBUTION_TEXT}>
      <TmdbWordmark />
      <Text
        style={[textStyle('bodySmall', { fontSize: 10 }), { color: colors.mut, textAlign: 'center', lineHeight: 14 }]}
      >
        {TMDB_ATTRIBUTION_TEXT}
      </Text>
    </View>
  );
}
