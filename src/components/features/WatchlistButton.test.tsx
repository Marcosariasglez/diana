// D2-3: botón «Quiero ver» (alta/baja de la watchlist). Usa el store REAL
// (useWatchlistStore) y solo mockea el espejo al servidor (@/services) y el
// registrador de errores (@/lib/syncError). Comprueba que el toggle actualiza
// el store y que el espejo (upsert/remove) se dispara según el estado final;
// un fallo de red NO rompe la UI (B-D9): reportSyncError se llama y el
// estado local ya está cambiado.
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/services', () => ({
  watchlistRepository: { upsert: jest.fn(), remove: jest.fn() },
}));
jest.mock('@/lib/syncError', () => ({ reportSyncError: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { watchlistRepository } from '@/services';
import { reportSyncError } from '@/lib/syncError';
import { useWatchlistStore } from '@/store/useWatchlistStore';
import { WatchlistButton } from './WatchlistButton';

const mockUpsert = watchlistRepository.upsert as jest.Mock;
const mockRemove = watchlistRepository.remove as jest.Mock;

describe('WatchlistButton (D2-3)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    useWatchlistStore.getState().setItems([]);
  });

  it('inactivo: muestra «Quiero ver» y al pulsar añade al store y espeja con upsert', async () => {
    mockUpsert.mockResolvedValue(undefined);
    await render(<WatchlistButton mediaType="movie" mediaId={7} />);
    const btn = screen.getByRole('button', { name: 'Añadir a la lista: Quiero ver' });
    expect(btn.props.accessibilityState.selected).toBe(false);
    await fireEvent.press(btn);
    expect(useWatchlistStore.getState().has('movie', 7)).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ mediaType: 'movie', mediaId: 7 }),
    );
    expect(mockRemove).not.toHaveBeenCalled();
    expect(reportSyncError).not.toHaveBeenCalled();
  });

  it('activo: muestra el rótulo activo y al pulsar quita y espeja con remove', async () => {
    mockRemove.mockResolvedValue(undefined);
    useWatchlistStore
      .getState()
      .setItems([{ mediaType: 'movie', mediaId: 7, addedAt: '2026-01-01T00:00:00.000Z' }]);
    await render(
      <WatchlistButton mediaType="movie" mediaId={7} activeLabel="En tu lista" />,
    );
    const btn = screen.getByRole('button', { name: 'Quitar de la lista: En tu lista' });
    expect(btn.props.accessibilityState.selected).toBe(true);
    await fireEvent.press(btn);
    expect(useWatchlistStore.getState().has('movie', 7)).toBe(false);
    expect(mockRemove).toHaveBeenCalledWith('movie', 7);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('fallo del espejo (red) no rompe la UI: reportSyncError se llama y el estado local persiste', async () => {
    mockUpsert.mockRejectedValue(new Error('network down'));
    await render(<WatchlistButton mediaType="tv" mediaId={3} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Añadir a la lista: Quiero ver' }));
    // B-D9: el estado local ya cambió; el fallo se registra y ya.
    expect(useWatchlistStore.getState().has('tv', 3)).toBe(true);
    expect(reportSyncError).toHaveBeenCalledTimes(1);
    expect(reportSyncError).toHaveBeenCalledWith(expect.any(Error));
  });
});
