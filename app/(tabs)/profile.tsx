import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2, User } from 'lucide-react-native';
import { TmdbAttribution } from '@/components/features/Attribution';
import { MetricCard } from '@/components/features/MetricCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HistoryRow } from '@/components/ui/HistoryRow';
import { ListRow } from '@/components/ui/ListRow';
import { ProfileCard } from '@/components/ui/ProfileCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { detailHref, sortHistory } from '@/features/profile/profileLogic';
import { DiarySection } from '@/features/profile/DiarySection';
import { WatchlistSection } from '@/features/profile/WatchlistSection';
import { useProfileImport } from '@/features/profile/useProfileImport';
import { useEntryPosters } from '@/features/profile/useEntryPosters';
import {
  selectAverageRating,
  selectSeenCount,
  useHistoryStore,
} from '@/store/useHistoryStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useSettingsStore, type ReducedMotionOverride } from '@/store/useSettingsStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { formatRating } from '@/utils/format';

// Cuántas entradas mostrar inicialmente en historial y diario
const COLLAPSED_COUNT = 5;

const APPEARANCE_OPTIONS = [
  { label: 'Claro', value: 'light' },
  { label: 'Oscuro', value: 'dark' },
  { label: 'Auto', value: 'auto' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const entries = useHistoryStore((s) => s.entries);
  const watched = useHistoryStore((s) => s.watched);
  const email = useAuthStore((s) => s.email);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const imp = useProfileImport();
  const [pages, setPages] = useState(1);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 84 + 24 + 24, gap: 14 },
    title: { color: c.ink, marginBottom: 12 },
    metrics: { flexDirection: 'row' as const, gap: 10 },
    card: { padding: 20, gap: 8 },
    cardTitle: { color: c.ink },
    cardText: { color: c.textSecondary, lineHeight: 24 },
    upload: { marginTop: 8 },
    progress: { gap: 8, marginTop: 8 },
    phase: { color: c.textSecondary },
    banner: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 8,
      padding: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    bannerError: { backgroundColor: c.negBg },
    bannerErrorText: { flex: 1, color: c.neg },
    bannerOk: { backgroundColor: c.accSoft },
    bannerOkText: { flex: 1, color: c.acc },
    historyHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 8,
    },
    legend: { color: c.textSecondary },
    emptyText: { color: c.textSecondary, paddingVertical: 12 },
    separator: { borderTopWidth: 1, borderTopColor: c.line },
    more: { marginTop: 12, minHeight: 48 },
    sectionGap: { gap: 0 },
    groupLabel: { color: c.mut, marginTop: 14, marginBottom: 2 },
    footer: { marginTop: 24, alignItems: 'center' as const, gap: 4 },
    footerText: { color: c.mut },
  }));

  const seen = useMemo(() => selectSeenCount({ entries, watched }), [entries, watched]);
  const average = useMemo(() => selectAverageRating({ entries }), [entries]);
  // D3: resolver pósters de las entradas visibles
  const entryPosters = useEntryPosters(entries);

  const empty = seen === 0;
  const seenText = empty ? '—' : String(seen);
  const avgText = formatRating(average);
  const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
          Perfil
        </Text>

        <ProfileCard
          name={displayName || (email ? email.split('@')[0] : 'Usuario')}
          subtitle={email ?? ''}
          initial={(displayName || email || 'U').charAt(0).toUpperCase()}
        />

        <View style={styles.metrics}>
          <MetricCard
            testID="metric-seen"
            title="Vistas"
            value={seenText}
            valueColor={empty ? colors.acc : colors.ink}
          />
          <MetricCard
            testID="metric-average"
            title="Tu nota media"
            value={avgText}
            valueColor={average === null ? colors.acc : colors.ink}
          />
        </View>

        <Card style={styles.card}>
          <Text style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20 }), styles.cardTitle]}>
            Importa tu historial
          </Text>
          <Text style={[textStyle('body'), styles.cardText]}>
            Sube el .csv o .zip de Letterboxd y la IA aprenderá tu gusto. También evita proponerte lo
            que ya viste.
          </Text>

          {imp.importing ? (
            <View style={styles.progress} accessibilityLiveRegion="polite">
              <ProgressBar
                value={imp.progress?.processed ?? 0}
                max={imp.progress && imp.progress.total > 0 ? imp.progress.total : 1}
              />
              <Text style={[textStyle('bodySmall'), styles.phase]}>{imp.phaseLabel}</Text>
            </View>
          ) : null}

          {imp.error ? (
            <View accessibilityRole="alert" style={[styles.banner, styles.bannerError]}>
              <AlertCircle size={20} color={colors.neg} />
              <Text style={[textStyle('bodySmall'), styles.bannerErrorText]}>{imp.error}</Text>
            </View>
          ) : null}

          {imp.summary ? (
            <View accessibilityLiveRegion="polite" style={[styles.banner, styles.bannerOk]}>
              <CheckCircle2 size={20} color={colors.acc} />
              <Text style={[textStyle('bodySmall'), styles.bannerOkText]}>{imp.summary}</Text>
            </View>
          ) : null}

          <Button
            variant="primary"
            label="Subir archivo Letterboxd"
            onPress={() => void imp.pickAndImport()}
            disabled={imp.importing}
            style={styles.upload}
          />
        </Card>

        {/* D2-3: lista «Quiero ver» (alta/baja desde ficha y mazo). */}
        <WatchlistSection />

        {/* Historial colapsable (6.2): muestra solo las 5 últimas por defecto */}
        <Card style={styles.card}>
          <View style={styles.historyHeader}>
            <Text style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20 }), styles.cardTitle]}>
              Historial
            </Text>
            <Text style={[textStyle('bodySmall'), styles.legend]}>Tu nota · IA</Text>
          </View>
          {entries.length === 0 ? (
            <Text style={[textStyle('body'), styles.emptyText]}>Aún no has valorado nada</Text>
          ) : (
            <View>
              {/* Historial ordenado (más reciente primero) */}
              {sortHistory(entries).slice(0, pages === 1 ? COLLAPSED_COUNT : undefined).map((entry, i) => {
                const mediaKey = `${entry.ref.mediaType}:${entry.ref.mediaId}`;
                const posterPath = entryPosters.get(mediaKey) ?? null;
                return (
                  <View key={entry.key} style={i > 0 ? styles.separator : undefined}>
                    <HistoryRow
                      entry={entry}
                      posterPath={posterPath}
                      onPress={() => router.push(detailHref(entry))}
                    />
                  </View>
                );
              })}
              {pages === 1 && entries.length > COLLAPSED_COUNT ? (
                <Button
                  variant="secondary"
                  label="Ver todo el historial"
                  accessibilityLabel={`Ver todo el historial (${entries.length} entradas)`}
                  onPress={() => setPages(2)}
                  style={styles.more}
                />
              ) : null}
            </View>
          )}
        </Card>

        {/* Diario (6.3): entradas añadidas manualmente con fecha (C4) */}
        <DiarySection />

        {/* Grupo Aplicación */}
        <Text style={[textStyle('label'), styles.groupLabel]}>APLICACIÓN</Text>
        <Card style={styles.sectionGap}>
          <ListRow
            first
            title="Apariencia"
            value={appearance === 'light' ? 'Claro' : appearance === 'dark' ? 'Oscuro' : 'Auto'}
          />
          <SegmentedControl
            options={APPEARANCE_OPTIONS}
            selected={appearance}
            onChange={(v) => setAppearance(v as 'light' | 'dark' | 'auto')}
          />
          <View style={{ paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }}>
            <Text style={[textStyle('bodyStrong'), { color: colors.ink }]}>Reducir movimiento</Text>
            <SegmentedControl
              options={[
                { label: 'Sistema', value: 'system' },
                { label: 'Sí', value: 'on' },
                { label: 'No', value: 'off' },
              ]}
              selected={reducedMotion}
              onChange={(v) => setReducedMotion(v as ReducedMotionOverride)}
            />
          </View>
        </Card>

        {/* Grupo Cuenta */}
        <Text style={[textStyle('label'), styles.groupLabel]}>CUENTA</Text>
        <Card style={styles.sectionGap}>
          <ListRow
            first
            title="Gestionar cuenta"
            subtitle="Cerrar sesión, exportar datos, borrar cuenta"
            icon={User}
            onPress={() => router.push('/account')}
          />
        </Card>

        {/* Pie */}
        <View style={styles.footer}>
          <TmdbAttribution />
          <Text style={[textStyle('bodySmall'), styles.footerText]}>
            Diana {APP_VERSION} · Una app de VERTICE
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}


