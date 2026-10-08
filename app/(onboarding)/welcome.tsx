import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Svg, { Circle, Rect } from 'react-native-svg';
import { Button, Screen } from '@/components/ui';
import { importRepository, ImportError, IMPORT_ERROR_MESSAGES } from '@/services';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';

const FAN = [
  { title: 'Aftersun', color: '#2B3A55', transform: [{ translateX: -30 }, { rotate: '-9deg' }], z: 1 },
  { title: 'Past Lives', color: '#5B4B6B', transform: [], z: 3 },
  { title: 'Burning', color: '#7A5C1E', transform: [{ translateX: 30 }, { rotate: '9deg' }], z: 2 },
] as const;

function DianaLogo({ accent }: { accent: string }) {
  // Logotipo A3.4: cuadrado de esquinas redondeadas (34 px radio 11; a 56 px, radio 18),
  // fondo acc + glifo onAcc. En viewBox 64, radio 18/56*64 = 20.6.
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="Logo de Diana" style={{ width: 56, height: 56 }}>
      <Svg width={56} height={56} viewBox="0 0 64 64">
        <Rect x={0} y={0} width={64} height={64} rx={20.6} fill={accent} />
        <Circle cx={32} cy={32} r={16} fill="none" stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={32} cy={32} r={9} fill="none" stroke="#FFFFFF" strokeWidth={3} />
        <Circle cx={32} cy={32} r={3} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const completeOnboarding = useProfileStore((s) => s.completeOnboarding);
  const importResult = useHistoryStore((s) => s.importResult);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    root: { flex: 1, paddingHorizontal: 20, paddingBottom: 24, alignItems: 'center' as const },
    fan: {
      height: 260,
      width: '100%',
      marginTop: 24,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    poster: {
      position: 'absolute' as const,
      top: 28,
      width: 130,
      height: 195,
      borderRadius: 14,
      justifyContent: 'flex-end' as const,
      padding: 10,
    },
    brand: { alignItems: 'center' as const, gap: 8, marginTop: 8 },
    title: {
      textAlign: 'center' as const,
      marginTop: 24,
    },
    actions: { marginTop: 'auto', width: '100%', gap: 12 },
    error: { color: c.neg, textAlign: 'center' as const, fontSize: 12.5 },
  }));

  const pickFile = async () => {
    setError(null);
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/zip', 'application/x-zip-compressed', '*/*'],
        copyToCacheDirectory: true,
      });
    } catch {
      setError(IMPORT_ERROR_MESSAGES['read-failed']);
      return;
    }
    const asset = picked.canceled ? undefined : picked.assets?.[0];
    if (!asset) return;
    setImporting(true);
    try {
      const result = await importRepository.parseLetterboxd({ uri: asset.uri, name: asset.name });
      if (result.matched > 0) {
        importResult(result);
        completeOnboarding();
      } else {
        setError(IMPORT_ERROR_MESSAGES['no-matches']);
      }
    } catch (e) {
      setError(e instanceof ImportError ? e.message : IMPORT_ERROR_MESSAGES['read-failed']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.root}>
        <View style={styles.fan} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {FAN.map((p) => (
            <View
              key={p.title}
              style={[
                styles.poster,
                SHADOWS.poster,
                { backgroundColor: p.color, zIndex: p.z, transform: [...p.transform] },
              ]}
            >
              <Text style={textStyle('posterTitle', { color: '#FFFFFF', fontSize: 16, fontFamily: 'Manrope-ExtraBold' })}>
                {p.title}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.brand}>
          <DianaLogo accent={colors.acc} />
          <Text style={textStyle('body', { fontFamily: 'Manrope-ExtraBold', color: colors.ink })}>Diana</Text>
        </View>

        <Text accessibilityRole="header" style={[textStyle('heroTitle'), { color: colors.ink }, styles.title]}>
          {'Encuentra tu\npróxima película\nfavorita en\nsegundos'}
        </Text>

        <View style={styles.actions}>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button
            label="Empezar test rápido"
            variant="primary"
            disabled={importing}
            onPress={() => router.push('/swipe-onboarding')}
          />
          <Button
            label="Ya tengo mi archivo de Letterboxd"
            variant="secondary"
            loading={importing}
            onPress={() => void pickFile()}
          />
        </View>
      </View>
    </Screen>
  );
}
