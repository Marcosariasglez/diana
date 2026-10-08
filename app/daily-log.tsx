import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { StarRating } from '@/components/features/StarRating';
import { TypeBadge } from '@/components/features/TypeBadge';
import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  PillGroup,
  Screen,
  SearchBar,
  Skeleton,
  useToast,
} from '@/components/ui';
import { resultKey, useDailyLogSearch } from '@/features/daily-log/useDailyLogSearch';
import { refOf, subtitleOf } from '@/features/daily-log/resultRef';
import { SAVE_ERROR_MESSAGE } from '@/features/detail/useDetailData';
import { selectEntryByKey, useHistoryStore } from '@/store/useHistoryStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { Rating } from '@/types/rating';
import type { SearchKind, SearchResult } from '@/types/search';
import { buildMediaKey } from '@/utils/mediaKey';

const FILTERS: { label: string; value: SearchKind }[] = [
  { label: 'Todo', value: 'all' },
  { label: 'Películas', value: 'movie' },
  { label: 'Series', value: 'tv' },
  { label: 'Capítulos', value: 'episode' },
];

const SAVED_MESSAGE = 'Nota guardada. Revela tu predicción en la ficha.';
const H_PADDING = 20;
const GAP = 12;
const MAX_CONTENT_WIDTH = 560;
const COLUMNS = 3;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

interface TileProps {
  result: SearchResult;
  width: number;
  selected: boolean;
  onPress: () => void;
  s: {
    tile: React.ComponentProps<typeof View>['style'];
    tileSelected: React.ComponentProps<typeof View>['style'];
    badge: React.ComponentProps<typeof View>['style'];
    tileTitle: React.ComponentProps<typeof Text>['style'];
    caption: React.ComponentProps<typeof Text>['style'];
  };
}

function ResultTile({ result, width, selected, onPress, s }: TileProps) {
  const height = Math.round((width * 3) / 2);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${result.label}: ${result.title}`}
      accessibilityState={{ selected }}
      style={{ width }}
    >
      <View
        style={[
          s.tile,
          { width, height, backgroundColor: result.posterColor },
          selected && s.tileSelected,
        ]}
      >
        <View style={s.badge}>
          <TypeBadge label={result.label} />
        </View>
        <Text numberOfLines={3} style={[textStyle('posterTitle', { color: 'white' }), s.tileTitle]}>
          {result.title}
        </Text>
      </View>
      <Text numberOfLines={2} style={[textStyle('bodySmall', { fontFamily: 'Inter-SemiBold' }), s.caption]}>
        {result.title}
      </Text>
    </Pressable>
  );
}

export default function DailyLogScreen() {
  const toast = useToast();
  const addEntry = useHistoryStore((s) => s.addEntry);
  const { width: windowWidth } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  const { status, results, retry } = useDailyLogSearch(query, kind);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) => StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    flex: { flex: 1 },
    column: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' as const },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingHorizontal: H_PADDING,
      paddingTop: 16,
    },
    title: { color: c.ink },
    closeBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.card,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    search: { paddingHorizontal: H_PADDING, marginTop: 20 },
    pills: { paddingHorizontal: H_PADDING, marginTop: 16 },
    results: { paddingHorizontal: H_PADDING, paddingTop: 20, paddingBottom: 40 },
    grid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: GAP, rowGap: 16 },
    tile: {
      borderRadius: 12,
      overflow: 'hidden' as const,
      justifyContent: 'flex-end' as const,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    tileSelected: { borderColor: c.acc },
    badge: { position: 'absolute' as const, top: 8, left: 8 },
    tileTitle: { paddingHorizontal: 8, paddingBottom: 8 },
    caption: { color: c.ink, marginTop: 8 },
    source: { color: c.textSecondary, marginTop: 24 },
    sheet: { gap: 16 },
    sheetHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12 },
    sheetTitle: { color: c.ink },
    sheetSubtitle: { color: c.textSecondary, marginTop: 2 },
    stars: { paddingHorizontal: 12 },
  }));

  const contentWidth = Math.min(windowWidth, MAX_CONTENT_WIDTH) - H_PADDING * 2;
  const tileWidth = Math.floor((contentWidth - GAP * (COLUMNS - 1)) / COLUMNS);

  const select = (r: SearchResult) => {
    const entry = selectEntryByKey(buildMediaKey(refOf(r)))(useHistoryStore.getState());
    setRating(entry ? entry.userRating : null);
    setSelected(r);
  };

  const save = () => {
    if (!selected || rating === null || saving) return;
    setSaving(true);
    addEntry({ mediaRef: refOf(selected), userRating: rating, origin: 'daily-log' })
      .then(() => {
        close();
        toast.show(SAVED_MESSAGE);
      })
      .catch(() => {
        setSaving(false);
        toast.show(SAVE_ERROR_MESSAGE);
      });
  };

  const selectedKey = selected ? resultKey(selected) : null;

  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.column}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[textStyle('screenTitle'), styles.title]}>
              Diario rápido
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              style={[styles.closeBtn, SHADOWS.card]}
            >
              <X size={22} color={colors.ink} strokeWidth={2.5} />
            </Pressable>
          </View>

          <View style={styles.search}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar películas y series" />
          </View>

          <View style={styles.pills}>
            <PillGroup
              activeColor={colors.ink}
              items={FILTERS}
              selected={[kind]}
              onChange={(sel) => setKind((sel[0] as SearchKind | undefined) ?? 'all')}
            />
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.results}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {status === 'idle' ? (
              <EmptyState icon={Search} title="Escribe para buscar" />
            ) : null}

            {status === 'loading' ? (
              <View
                testID="daily-log-skeleton"
                accessibilityRole="progressbar"
                accessibilityLabel="Buscando"
                style={styles.grid}
              >
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={{ width: tileWidth, gap: 8 }}>
                    <Skeleton width={tileWidth} height={Math.round((tileWidth * 3) / 2)} radius={12} />
                    <Skeleton width="70%" height={14} />
                  </View>
                ))}
              </View>
            ) : null}

            {status === 'error' ? (
              <ErrorState message="No pudimos buscar. Inténtalo de nuevo." onRetry={retry} />
            ) : null}

            {status === 'ready' && results.length === 0 ? (
              <EmptyState icon={Search} title="No encontramos nada con esa búsqueda" />
            ) : null}

            {status === 'ready' && results.length > 0 ? (
              <>
                <View style={styles.grid}>
                  {results.map((r) => (
                    <ResultTile
                      key={resultKey(r)}
                      result={r}
                      width={tileWidth}
                      selected={resultKey(r) === selectedKey}
                      onPress={() => select(r)}
                      s={styles}
                    />
                  ))}
                </View>
                <Text style={[textStyle('body'), styles.source]}>Resultados de TMDB</Text>
              </>
            ) : null}
          </ScrollView>
        </View>
      </Screen>

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} snapPoints={[0.5]}>
        {selected ? (
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <Text accessibilityRole="header" style={[textStyle('detailTitle'), styles.sheetTitle]}>
                  {selected.seriesTitle ?? selected.title}
                </Text>
                <Text style={[textStyle('bodySmall'), styles.sheetSubtitle]}>{subtitleOf(selected)}</Text>
              </View>
              <Chip label={selected.label} variant="outline" />
            </View>
            <View style={styles.stars}>
              <StarRating value={rating} onChange={setRating} size={40} />
            </View>
            <Button label="Guardar" onPress={save} disabled={rating === null} loading={saving} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

