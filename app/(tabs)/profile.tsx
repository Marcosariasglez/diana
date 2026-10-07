import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { MetricCard } from '@/components/features/MetricCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { HistoryRow } from '@/components/ui/HistoryRow';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { HISTORY_PAGE_SIZE, detailHref, paginateHistory } from '@/features/profile/profileLogic';
import { resetPrototype } from '@/features/profile/resetPrototype';
import { useProfileImport } from '@/features/profile/useProfileImport';
import {
  selectAverageRating,
  selectSeenCount,
  useHistoryStore,
} from '@/store/useHistoryStore';
import { useSettingsStore, type ReducedMotionOverride } from '@/store/useSettingsStore';
import { COLORS } from '@/theme/colors';
import { textStyle } from '@/theme/typography';
import { formatRating } from '@/utils/format';

const MOTION_OPTIONS = [
  { label: 'Sistema', value: 'system' },
  { label: 'Sí', value: 'on' },
  { label: 'No', value: 'off' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const entries = useHistoryStore((s) => s.entries);
  const watched = useHistoryStore((s) => s.watched);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const imp = useProfileImport();
  const [pages, setPages] = useState(1);
  const [confirmReset, setConfirmReset] = useState(false);

  const seen = useMemo(() => selectSeenCount({ entries, watched }), [entries, watched]);
  const average = useMemo(() => selectAverageRating({ entries }), [entries]);
  const { visible, hasMore } = useMemo(() => paginateHistory(entries, pages), [entries, pages]);

  const empty = seen === 0;
  const seenText = empty ? '—' : String(seen);
  const avgText = formatRating(average);

  const onReset = async () => {
    await resetPrototype();
    setConfirmReset(false);
    setPages(1);
    router.replace('/welcome');
  };

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

        <View style={styles.metrics}>
          <MetricCard
            testID="metric-seen"
            title="Vistas"
            value={seenText}
            valueColor={empty ? COLORS.accent : COLORS.textPrimary}
          />
          <MetricCard
            testID="metric-average"
            title="Tu nota media"
            value={avgText}
            valueColor={average === null ? COLORS.accent : COLORS.textPrimary}
          />
        </View>

        <Card style={styles.card}>
          <Text style={[textStyle('body', { fontWeight: '800', fontSize: 20 }), styles.cardTitle]}>
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
              <AlertCircle size={20} color="#B3261E" />
              <Text style={[textStyle('bodySmall'), styles.bannerErrorText]}>{imp.error}</Text>
            </View>
          ) : null}

          {imp.summary ? (
            <View accessibilityLiveRegion="polite" style={[styles.banner, styles.bannerOk]}>
              <CheckCircle2 size={20} color={COLORS.accentSoftText} />
              <Text style={[textStyle('bodySmall'), styles.bannerOkText]}>{imp.summary}</Text>
            </View>
          ) : null}

          <Button
            variant="dark"
            label="Subir archivo Letterboxd"
            onPress={() => void imp.pickAndImport()}
            disabled={imp.importing}
            style={styles.upload}
          />
        </Card>

        <Card style={styles.card}>
          <View style={styles.historyHeader}>
            <Text style={[textStyle('body', { fontWeight: '800', fontSize: 20 }), styles.cardTitle]}>
              Historial
            </Text>
            <Text style={[textStyle('bodySmall'), styles.legend]}>Tu nota · IA</Text>
          </View>
          {entries.length === 0 ? (
            <Text style={[textStyle('body'), styles.emptyText]}>Aún no has valorado nada</Text>
          ) : (
            <View>
              {visible.map((entry, i) => (
                <View key={entry.key} style={i > 0 ? styles.separator : undefined}>
                  <HistoryRow entry={entry} onPress={() => router.push(detailHref(entry))} />
                </View>
              ))}
              {hasMore ? (
                <Button
                  variant="secondary"
                  label="Mostrar más"
                  accessibilityLabel={`Mostrar ${HISTORY_PAGE_SIZE} más`}
                  onPress={() => setPages((p) => p + 1)}
                  style={styles.more}
                />
              ) : null}
            </View>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={[textStyle('body', { fontWeight: '800', fontSize: 20 }), styles.cardTitle]}>
            Ajustes
          </Text>
          <Text style={[textStyle('bodySmall'), styles.settingLabel]}>Reducir movimiento</Text>
          <SegmentedControl
            options={MOTION_OPTIONS}
            selected={reducedMotion}
            onChange={(v) => setReducedMotion(v as ReducedMotionOverride)}
          />
          {confirmReset ? (
            <View style={styles.confirm}>
              <Text style={[textStyle('bodySmall'), styles.cardText]}>
                Se borrarán tu historial y tu perfil, y volverás a la bienvenida. ¿Reiniciar el
                prototipo?
              </Text>
              <View style={styles.confirmRow}>
                <Button
                  variant="secondary"
                  label="Cancelar"
                  onPress={() => setConfirmReset(false)}
                  style={styles.flex}
                />
                <Button
                  variant="dark"
                  label="Reiniciar"
                  onPress={() => void onReset()}
                  style={styles.flex}
                />
              </View>
            </View>
          ) : (
            <Button
              variant="secondary"
              label="Reiniciar prototipo"
              onPress={() => setConfirmReset(true)}
              style={styles.reset}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 84 + 24 + 24, gap: 12 },
  title: { color: COLORS.textPrimary, marginBottom: 8 },
  metrics: { flexDirection: 'row', gap: 12 },
  card: { padding: 20, gap: 8 },
  cardTitle: { color: COLORS.textPrimary },
  cardText: { color: COLORS.textSecondary, lineHeight: 24 },
  upload: { marginTop: 8 },
  progress: { gap: 8, marginTop: 8 },
  phase: { color: COLORS.textSecondary },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  bannerError: { backgroundColor: '#FDECEA' },
  bannerErrorText: { flex: 1, color: '#8C1D18' },
  bannerOk: { backgroundColor: COLORS.accentSoft },
  bannerOkText: { flex: 1, color: COLORS.accentSoftText },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  legend: { color: COLORS.textSecondary },
  emptyText: { color: COLORS.textSecondary, paddingVertical: 12 },
  separator: { borderTopWidth: 1, borderTopColor: COLORS.divider },
  more: { marginTop: 12, minHeight: 48 },
  settingLabel: { color: COLORS.textSecondary, marginTop: 4 },
  reset: { marginTop: 8, minHeight: 48 },
  confirm: { gap: 12, marginTop: 8 },
  confirmRow: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1, paddingHorizontal: 12 },
});
