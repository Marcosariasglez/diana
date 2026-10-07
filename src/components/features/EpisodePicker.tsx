import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/theme/colors';
import { SHADOWS } from '@/theme/shadows';
import { textStyle } from '@/theme/typography';
import type { TVSeason } from '@/types/media';

export interface EpisodeSelection {
  season: number | null;
  episode: number | null;
}

export interface EpisodePickerProps {
  seasons: TVSeason[];
  /** Temporada seleccionada (null = serie completa). */
  season: number | null;
  /** Capitulo seleccionado (null = nivel de temporada). */
  episode: number | null;
  onChange: (selection: EpisodeSelection) => void;
}

export function EpisodePicker({ seasons, season, episode, onChange }: EpisodePickerProps) {
  const [open, setOpen] = useState(false);
  if (seasons.length === 0) return null;

  const current = seasons.find((s) => s.season_number === season);
  const episodes = current?.episodes ?? [];

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={
            current ? `Temporada ${current.season_number}, cambiar temporada` : 'Elegir temporada'
          }
          accessibilityState={{ expanded: open }}
          style={[styles.pill, styles.dark]}
        >
          <Text style={textStyle('body', { fontWeight: '700', color: '#FFFFFF' })}>
            {current ? `Temporada ${current.season_number}` : 'Temporada'}
          </Text>
          <ChevronDown size={16} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
        {episodes.map((ep) => {
          const selected = ep.episode_number === episode;
          return (
            <Pressable
              key={ep.episode_number}
              onPress={() =>
                onChange({ season, episode: selected ? null : ep.episode_number })
              }
              accessibilityRole="button"
              accessibilityLabel={`Capítulo ${ep.episode_number}: ${ep.name}`}
              accessibilityState={{ selected }}
              style={[styles.pill, selected ? styles.dark : styles.light, !selected && SHADOWS.card]}
            >
              <Text
                style={textStyle('body', {
                  fontWeight: '700',
                  color: selected ? '#FFFFFF' : COLORS.textPrimary,
                })}
              >
                {`E${ep.episode_number}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {open ? (
        <View style={[styles.menu, SHADOWS.card]}>
          <Pressable
            onPress={() => {
              setOpen(false);
              onChange({ season: null, episode: null });
            }}
            accessibilityRole="button"
            accessibilityLabel="Serie completa"
            accessibilityState={{ selected: season === null }}
            style={styles.menuItem}
          >
            <Text style={textStyle('body', { color: COLORS.textPrimary })}>Serie completa</Text>
            {season === null ? <Check size={18} color={COLORS.accent} strokeWidth={2.5} /> : null}
          </Pressable>
          {seasons.map((s) => (
            <Pressable
              key={s.season_number}
              onPress={() => {
                setOpen(false);
                onChange({ season: s.season_number, episode: null });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Temporada ${s.season_number}`}
              accessibilityState={{ selected: s.season_number === season }}
              style={styles.menuItem}
            >
              <Text style={textStyle('body', { color: COLORS.textPrimary })}>
                {`Temporada ${s.season_number}`}
              </Text>
              {s.season_number === season ? (
                <Check size={18} color={COLORS.accent} strokeWidth={2.5} />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  pill: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dark: {
    backgroundColor: COLORS.textPrimary,
  },
  light: {
    backgroundColor: COLORS.card,
  },
  menu: {
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
