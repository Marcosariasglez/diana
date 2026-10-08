import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Film, Heart } from 'lucide-react-native';
import type { HistoryEntry } from '@/types/rating';
import { useTheme } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { AvatarSlot } from './AvatarSlot';
import { BottomNav, type BottomNavProps } from './BottomNav';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Card } from './Card';
import { Chip } from './Chip';
import { CodeInput } from './CodeInput';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { FabButton } from './FabButton';
import { HistoryRow } from './HistoryRow';
import { LockedAffinityChip } from './LockedAffinityChip';
import { Pill } from './Pill';
import { PillGroup } from './PillGroup';
import { ProgressBar } from './ProgressBar';
import { RoomCodeTiles } from './RoomCodeTiles';
import { Screen } from './Screen';
import { SearchBar } from './SearchBar';
import { SegmentedControl } from './SegmentedControl';
import { Skeleton } from './Skeleton';
import { Toast, ToastProvider, useToast } from './Toast';

const SAMPLE: HistoryEntry = {
  key: 'movie:1',
  ref: { mediaType: 'movie', mediaId: 1 },
  title: 'Dune',
  posterColor: '#3B4A5A',
  userRating: 4.5,
  aiPrediction: 3.8,
  predictionSeen: false,
  ratedAt: '2026-01-01T00:00:00.000Z',
  source: 'app',
};

const NAV_PROPS = {
  state: {
    index: 0,
    routes: [
      { key: 'index-k', name: 'index' },
      { key: 'mood-k', name: 'mood' },
      { key: 'match-k', name: 'match' },
      { key: 'profile-k', name: 'profile' },
    ],
  },
  navigation: { emit: () => ({ defaultPrevented: false }), navigate: () => undefined },
} as unknown as BottomNavProps;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[textStyle('label'), { color: colors.textSecondary, textTransform: 'uppercase' }]}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function GalleryBody() {
  const { colors } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [segment, setSegment] = useState('movie');
  const [single, setSingle] = useState<string[]>(['drama']);
  const [multi, setMulti] = useState<string[]>(['a', 'b']);
  const pills = [
    { label: 'Drama', value: 'drama' },
    { label: 'Comedia', value: 'comedia' },
    { label: 'Terror', value: 'terror' },
  ];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[textStyle('screenTitle'), { color: colors.ink }]}>
          Galería de componentes
        </Text>

        <Section title="Button">
          <Button label="Primario" onPress={() => toast.show('Botón primario')} />
          <Button label="Secundario" variant="secondary" onPress={() => undefined} />
          <Button label="Principal" variant="primary" onPress={() => undefined} />
          <Button label="Cargando" loading onPress={() => undefined} />
          <Button label="Deshabilitado" disabled onPress={() => undefined} />
        </Section>

        <Section title="Pill y PillGroup">
          <Pill label="Activa" active />
          <Pill label="Inactiva" />
          <PillGroup items={pills} selected={single} onChange={setSingle} />
          <PillGroup
            multiple
            items={[
              { label: 'Opción A', value: 'a' },
              { label: 'Opción B', value: 'b' },
              { label: 'Opción C', value: 'c' },
            ]}
            selected={multi}
            onChange={setMulti}
          />
        </Section>

        <Section title="Chip">
          <View style={styles.row}>
            <Chip label="Por defecto" />
            <Chip label="Acento" variant="accent" icon={Film} />
            <Chip label="Blanco" variant="white" />
            <Chip label="Contorno" variant="outline" icon={Heart} />
          </View>
        </Section>

        <Section title="Card">
          <Card>
            <Text style={textStyle('body')}>Tarjeta estática</Text>
          </Card>
          <Card onPress={() => toast.show('Tarjeta pulsada')} accessibilityLabel="Tarjeta pulsable">
            <Text style={textStyle('body')}>Tarjeta pulsable</Text>
          </Card>
        </Section>

        <Section title="SegmentedControl">
          <SegmentedControl
            options={[
              { label: 'Películas', value: 'movie' },
              { label: 'Series', value: 'tv' },
            ]}
            selected={segment}
            onChange={setSegment}
          />
        </Section>

        <Section title="ProgressBar">
          <ProgressBar value={7} max={20} />
          <ProgressBar value={3} max={5} segments={5} />
        </Section>

        <Section title="AvatarSlot">
          <View style={styles.row}>
            <AvatarSlot occupied initial="M" name="Marta" />
            <AvatarSlot occupied initial="D" name="Diego" tone="dark" />
            <AvatarSlot />
          </View>
        </Section>

        <Section title="SearchBar">
          <SearchBar value={search} onChangeText={setSearch} />
        </Section>

        <Section title="CodeInput y RoomCodeTiles">
          <CodeInput value={code} onChange={setCode} />
          <CodeInput value="ABCD" onChange={() => undefined} error />
          <RoomCodeTiles code="X49B" onCopy={() => toast.show('Código copiado')} />
        </Section>

        <Section title="LockedAffinityChip">
          <View style={styles.row}>
            <LockedAffinityChip bucket="alto" />
            <LockedAffinityChip bucket="medio" />
            <LockedAffinityChip bucket="alto" locked={false} />
          </View>
        </Section>

        <Section title="HistoryRow">
          <HistoryRow entry={SAMPLE} />
          <HistoryRow entry={{ ...SAMPLE, key: 'movie:2', title: 'Alien', predictionSeen: true }} />
        </Section>

        <Section title="Skeleton">
          <Skeleton width="100%" height={20} />
          <Skeleton width={120} height={180} radius={12} />
        </Section>

        <Section title="EmptyState y ErrorState">
          <EmptyState
            icon={Film}
            title="Aún no hay nada"
            message="Califica algunas películas para empezar."
            action={{ label: 'Explorar', onPress: () => undefined }}
          />
          <ErrorState message="No se pudo cargar el contenido." onRetry={() => undefined} />
        </Section>

        <Section title="Toast, FabButton y BottomSheet">
          <Toast message="Toast estático" visible />
          <View style={styles.row}>
            <FabButton onPress={() => toast.show('Registro rápido')} />
          </View>
          <Button label="Abrir BottomSheet" variant="secondary" onPress={() => setSheet(true)} />
        </Section>

        <Section title="BottomNav">
          <BottomNav {...NAV_PROPS} onFabPress={() => toast.show('FAB')} />
        </Section>
      </ScrollView>
      <BottomSheet visible={sheet} onClose={() => setSheet(false)}>
        <Text style={[textStyle('detailTitle'), { color: colors.ink }]}>Diario rápido</Text>
        <Button label="Cerrar" onPress={() => setSheet(false)} />
      </BottomSheet>
    </Screen>
  );
}

export function Gallery() {
  return (
    <ToastProvider>
      <GalleryBody />
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 24, paddingBottom: 120 },
  section: { gap: 12 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', alignItems: 'center' },
});
