/// <reference types="jest" />
/**
 * C4: Pruebas de DiarySection (RNTL).
 *
 * Verifica que:
 *  - tras addEntry con loggedAt presente aparece en la sección Diario;
 *  - una valoración sin loggedAt no aparece;
 *  - estado vacío muestra EmptyState;
 *  - botón "Ver todo el diario" aparece con más de COLLAPSED_COUNT entradas.
 */
import { render, screen } from '@testing-library/react-native';
import { DiarySection } from './DiarySection';
import { useHistoryStore } from '@/store/useHistoryStore';
import type { HistoryEntry, Rating } from '@/types/rating';

jest.mock('@/store/useHistoryStore', () => ({
  useHistoryStore: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    key: 'movie:1',
    ref: { mediaType: 'movie', mediaId: 1 },
    title: 'Test Movie',
    posterPath: null,
    posterColor: '#f0f0f0',
    userRating: 8 as Rating,
    aiPrediction: 70,
    predictionSeen: false,
    ratedAt: '2026-01-01T00:00:00Z',
    source: 'app',
    loggedAt: '2026-10-13T12:00:00Z',
    ...overrides,
  };
}

describe('DiarySection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('muestra estado vacío sin entradas del diario', async () => {
    (useHistoryStore as unknown as jest.Mock).mockImplementation((selector) => selector({ entries: [] }));
    await render(<DiarySection />);
    expect(screen.getByText('Registra lo que ves día a día con el botón «+»')).toBeTruthy();
    expect(screen.getByText('Añadir al diario')).toBeTruthy();
  });

  it('muestra entrada con loggedAt presente', async () => {
    const entry = makeEntry({ key: 'movie:1', title: 'Diary Entry' });
    (useHistoryStore as unknown as jest.Mock).mockImplementation((selector) => selector({ entries: [entry] }));
    await render(<DiarySection />);
    expect(screen.getByText('Diary Entry')).toBeTruthy();
  });

  it('no muestra entrada sin loggedAt', async () => {
    const entry = makeEntry({ key: 'movie:2', loggedAt: null, title: 'Detail Entry' });
    (useHistoryStore as unknown as jest.Mock).mockImplementation((selector) => selector({ entries: [entry] }));
    await render(<DiarySection />);
    expect(screen.queryByText('Detail Entry')).toBeFalsy();
    expect(screen.getByText('Registra lo que ves día a día con el botón «+»')).toBeTruthy();
  });

  it('muestra botón "Ver todo el diario" con más de 5 entradas', async () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 6; i++) {
      entries.push(makeEntry({ key: `movie:${i}`, title: `Entry ${i}` }));
    }
    (useHistoryStore as unknown as jest.Mock).mockImplementation((selector) => selector({ entries }));
    await render(<DiarySection />);
    expect(screen.getByText('Ver todo el diario')).toBeTruthy();
  });

  it('no muestra botón "Ver todo el diario" con 5 o menos entradas', async () => {
    const entries: HistoryEntry[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ key: `movie:${i}`, title: `Entry ${i}` }));
    }
    (useHistoryStore as unknown as jest.Mock).mockImplementation((selector) => selector({ entries }));
    await render(<DiarySection />);
    expect(screen.queryByText('Ver todo el diario')).toBeFalsy();
  });
});
