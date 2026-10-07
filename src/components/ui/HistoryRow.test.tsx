import { fireEvent, render, screen } from '@testing-library/react-native';
import type { HistoryEntry } from '@/types/rating';
import { HistoryRow } from './HistoryRow';

const entry: HistoryEntry = {
  key: 'movie:1',
  ref: { mediaType: 'movie', mediaId: 1 },
  title: 'Dune',
  posterColor: '#334455',
  userRating: 4.5,
  aiPrediction: 3.8,
  predictionSeen: false,
  ratedAt: '2026-01-01T00:00:00.000Z',
  source: 'app',
};

describe('HistoryRow', () => {
  it('IA bloqueada si predictionSeen=false', async () => {
    await render(<HistoryRow entry={entry} />);
    expect(screen.getByText('Dune')).toBeTruthy();
    expect(screen.getByLabelText('Tu nota 4,5')).toBeTruthy();
    expect(screen.queryByText('3,8')).toBeNull();
    expect(screen.getByLabelText('Predicción bloqueada')).toBeTruthy();
    expect(screen.getByTestId('history-lock', { includeHiddenElements: true })).toBeTruthy();
  });
  it('IA visible si predictionSeen=true', async () => {
    const onPress = jest.fn();
    await render(<HistoryRow entry={{ ...entry, predictionSeen: true }} onPress={onPress} />);
    expect(screen.getByText('3,8')).toBeTruthy();
    expect(screen.getByLabelText('Predicción de IA 3,8')).toBeTruthy();
    expect(screen.queryByTestId('history-lock', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalled();
  });
});
