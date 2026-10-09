import { Check, Bookmark } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { watchlistRepository } from '@/services';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { reportSyncError } from '@/lib/syncError';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { textStyle } from '@/theme/typography';
import type { MediaType } from '@/types/media';

/**
 * VERTICE-PLAN-2, D2-3: botón «Quiero ver» (alta/baja de la watchlist).
 * Se usa en la ficha (D2-3.1) y como topBadge sobre la carta del mazo
 * (SwipeDeck). El estado vive en useWatchlistStore (persistencia local);
 * si hay servidor (BACKEND=supabase) se espeja a la tabla `watchlist`
 * (migración 0008). Los fallos de red NO bloquean la UI (B-D9): se
 * registran y ya.
 */
export interface WatchlistButtonProps {
  mediaType: MediaType;
  mediaId: number;
  /** small: chip compacto para la carta del mazo; medium: ficha. */
  size?: 'small' | 'medium';
  /** Rótulo cuando está activo (defecto: «En tu lista»). */
  activeLabel?: string;
}

export function WatchlistButton({
  mediaType,
  mediaId,
  size = 'medium',
  activeLabel = 'En tu lista',
}: WatchlistButtonProps) {
  const inList = useWatchlistStore((s) => s.has(mediaType, mediaId));
  const toggle = useWatchlistStore((s) => s.toggle);
  const { colors } = useTheme();
  const styles = useThemedStyles(() =>
    StyleSheet.create({
      row: {
        flexDirection: 'row' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 99,
        borderWidth: 1,
        paddingVertical: size === 'small' ? 6 : 10,
        paddingHorizontal: size === 'small' ? 12 : 16,
        minHeight: size === 'small' ? 32 : 44,
      },
      label: { fontSize: size === 'small' ? 13 : 14 },
    }),
  );

  const onPress = () => {
    toggle(mediaType, mediaId);
    // Espejo al servidor solo si el estado final es «en la lista».
    if (useWatchlistStore.getState().has(mediaType, mediaId)) {
      const item = useWatchlistStore
        .getState()
        .items.find((i) => i.mediaType === mediaType && i.mediaId === mediaId);
      if (item) void watchlistRepository.upsert(item).catch(reportSyncError);
    } else {
      void watchlistRepository.remove(mediaType, mediaId).catch(reportSyncError);
    }
  };

  const active = inList;
  const Icon = active ? Check : Bookmark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={active ? `Quitar de la lista: ${activeLabel}` : 'Añadir a la lista: Quiero ver'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: active ? colors.acc : colors.card,
          borderColor: active ? colors.acc : colors.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon size={size === 'small' ? 16 : 18} color={active ? colors.onAcc : colors.ink} strokeWidth={2} />
      <Text style={[textStyle('bodyStrong'), styles.label, { color: active ? colors.onAcc : colors.ink }]}>
        {active ? activeLabel : 'Quiero ver'}
      </Text>
    </Pressable>
  );
}
