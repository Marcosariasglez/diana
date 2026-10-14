import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Plus } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EntryPoster } from '@/components/features/EntryPoster';
import { EmptyState } from '@/components/ui/EmptyState';
import { diaryEntries, groupByDay } from './diaryLogic';
import { detailHref } from './profileLogic';
import { useEntryPosters, mediaKeyOf } from './useEntryPosters';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import { formatRating } from '@/utils/format';
import type { HistoryEntry } from '@/types/rating';

const COLLAPSED_COUNT = 5;

export function DiarySection() {
  const router = useRouter();
  const entries = useHistoryStore((s) => s.entries);
  const [expanded, setExpanded] = useState(false);
  const { colors } = useTheme();
  const styles = useThemedStyles((c) =>
    StyleSheet.create({
      header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 8,
        gap: 8,
      },
      titleRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 8,
      },
      cardTitle: { color: c.ink },
      dayLabel: { color: c.mut, marginTop: 12, marginBottom: 2 },
      more: { marginTop: 12, minHeight: 48 },
    }),
  );

  const diary = useMemo(() => diaryEntries(entries), [entries]);
  const groups = useMemo(() => groupByDay(diary), [diary]);
  const entryPosters = useEntryPosters(diary);
  const visible = expanded ? diary : diary.slice(0, COLLAPSED_COUNT);
  const canExpand = diary.length > COLLAPSED_COUNT;

  if (diary.length === 0) {
    return (
      <Card>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Calendar size={18} color={colors.acc} strokeWidth={2} />
            <Text style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20 }), styles.cardTitle]}>
              Diario
            </Text>
          </View>
        </View>
        <EmptyState
          icon={Plus}
          title="Registra lo que ves día a día con el botón «+»"
          action={{
            label: 'Añadir al diario',
            onPress: () => router.push('/daily-log'),
          }}
        />
      </Card>
    );
  }

  // Track which entry is the first of its group for separator logic
  const groupFirstIndices = new Set<number>();
  let globalIdx = 0;
  for (const group of groups) {
    for (let j = 0; j < group.entries.length; j++) {
      if (j === 0 && globalIdx < visible.length) {
        groupFirstIndices.add(globalIdx);
      }
      globalIdx++;
    }
  }

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Calendar size={18} color={colors.acc} strokeWidth={2} />
          <Text style={[textStyle('body', { fontFamily: 'Manrope-ExtraBold', fontSize: 20 }), styles.cardTitle]}>
            Diario
          </Text>
        </View>
        <Text style={[textStyle('bodySmall'), { color: colors.textSecondary }]}>
          {diary.length} {diary.length === 1 ? 'entrada' : 'entradas'}
        </Text>
      </View>

      {groups.map((group) => {
        // Filter entries in this group that are within the visible slice
        const groupEntries = group.entries.filter((e) => visible.includes(e));
        if (groupEntries.length === 0) return null;

        return (
          <View key={group.label}>
            <Text style={[textStyle('label'), styles.dayLabel]}>{group.label}</Text>
            {groupEntries.map((entry) => {
              const gi = visible.indexOf(entry);
              const isFirst = groupFirstIndices.has(gi);
              const posterPath = entryPosters.get(mediaKeyOf(entry)) ?? null;
              return (
                <DiaryRow
                  key={entry.key}
                  entry={entry}
                  posterPath={posterPath}
                  isFirst={isFirst}
                  onPress={() => router.push(detailHref(entry))}
                />
              );
            })}
          </View>
        );
      })}

      {canExpand && !expanded ? (
        <Button
          variant="secondary"
          label="Ver todo el diario"
          accessibilityLabel={`Ver todo el diario (${diary.length} entradas)`}
          onPress={() => setExpanded(true)}
          style={styles.more}
        />
      ) : null}
    </Card>
  );
}

interface DiaryRowProps {
  entry: HistoryEntry;
  posterPath: string | null;
  isFirst: boolean;
  onPress: () => void;
}

function DiaryRow({ entry, posterPath, isFirst, onPress }: DiaryRowProps) {
  const { colors } = useTheme();
  const rating = formatRating(entry.userRating);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, tu nota ${rating}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 8,
          ...(isFirst ? {} : { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }),
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <EntryPoster
        posterPath={posterPath}
        color={entry.posterColor}
        title={entry.title}
        width={40}
        height={58}
        radius={10}
      />
      <Text
        numberOfLines={1}
        style={[textStyle('body', { fontFamily: 'Inter-SemiBold' }), { color: colors.ink, flex: 1, minWidth: 0 }]}
      >
        {entry.title}
      </Text>
      <View
        accessible
        accessibilityLabel={`Tu nota ${rating}`}
        style={{
          minWidth: 44,
          height: 36,
          paddingHorizontal: 12,
          borderRadius: 99,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.chip,
        }}
      >
        <Text style={[textStyle('bodySmall', { fontFamily: 'Inter-Bold', fontVariant: ['tabular-nums'] }), { color: colors.ink }]}>
          {rating}
        </Text>
      </View>
    </Pressable>
  );
}
