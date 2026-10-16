/**
 * Pantalla Inicio: estados y orden (hero → Top 10 → filas), y regla de
 * privacidad de nota: ningún texto numérico de nota de IA en Inicio.
 */
import { render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import type { FeedItem, FeedRow } from '@/types/media';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockFeed = jest.fn();
jest.mock('@/features/feed/usePersonalizedFeed', () => ({
  usePersonalizedFeed: () => mockFeed(),
}));

import Home from '../../../../app/(tabs)/index';

const item = (i: number, bucket: FeedItem['bucket'] = 'alto'): FeedItem => ({
  media: { ...FIXTURE_MOVIES[0], id: 5000 + i, title: `Titulo ${i}` } as FeedItem['media'],
  bucket,
  reason: i === 0 ? { kind: 'liked', text: 'Porque te gustó Past Lives' } : undefined,
});

const row = (id: string, title: string, subtitle?: string): FeedRow => ({
  id,
  title,
  subtitle,
  items: [item(20), item(21)],
  seeAll: id === 'popular' ? 'popular' : null,
});

function feed(overrides: Record<string, unknown> = {}) {
  return {
    hero: [0, 1, 2, 3, 4].map((i) => item(i)),
    top10: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((i) => item(i, 'medio')),
    rows: [row('popular', 'Populares en tus plataformas'), row('personalized:1', 'Porque te gustó Sicario', 'Basado en tus valoraciones')],
    status: 'ready',
    platforms: ['netflix'],
    loadingMore: false,
    rowsError: false,
    setPlatforms: jest.fn(),
    reload: jest.fn(),
    loadMoreRows: jest.fn(),
    ...overrides,
  };
}

/** Todo lo que lee el usuario: textos y labels de accesibilidad (sin estilos). */
function userFacingText(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => userFacingText(n, out));
  else if (node && typeof node === 'object') {
    const n = node as { props?: Record<string, unknown>; children?: unknown };
    const label = n.props?.accessibilityLabel;
    if (typeof label === 'string') out.push(label);
    userFacingText(n.children, out);
  }
  return out;
}

describe('Inicio · estados', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeed.mockReturnValue(feed());
  });

  it('sin plataformas pide elegir alguna', async () => {
    mockFeed.mockReturnValue(feed({ platforms: [], hero: [], top10: [], rows: [], status: 'idle' }));
    await render(<Home />);
    expect(screen.getByText('Elige al menos una plataforma')).toBeTruthy();
  });

  it('cargando muestra el esqueleto', async () => {
    mockFeed.mockReturnValue(feed({ status: 'loading', hero: [], top10: [], rows: [] }));
    await render(<Home />);
    expect(screen.getByLabelText('Cargando tu feed')).toBeTruthy();
  });

  it('error total muestra ErrorState', async () => {
    mockFeed.mockReturnValue(feed({ status: 'error', hero: [], top10: [], rows: [] }));
    await render(<Home />);
    expect(screen.getByText('No pudimos cargar tu feed')).toBeTruthy();
  });

  it('sin nada que mostrar da un estado vacío', async () => {
    mockFeed.mockReturnValue(feed({ hero: [], top10: [], rows: [] }));
    await render(<Home />);
    expect(screen.getByText('No hay títulos para estas plataformas')).toBeTruthy();
  });

  it('un error de filas con contenido ya cargado ofrece reintentar sin romper el feed', async () => {
    mockFeed.mockReturnValue(feed({ rowsError: true }));
    await render(<Home />);
    expect(screen.getByLabelText('Reintentar')).toBeTruthy();
    expect(screen.getByText('Top 10 para ti')).toBeTruthy();
  });
});

describe('Inicio · contenido', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeed.mockReturnValue(feed());
  });

  it('muestra hero, Top 10 y filas con subtítulo, en ese orden', async () => {
    await render(<Home />);
    const tree = JSON.stringify(screen.toJSON());
    const hero = tree.indexOf('Para ti, 1 de 5');
    const top = tree.indexOf('Top 10 para ti');
    const rows = tree.indexOf('Populares en tus plataformas');
    expect(hero).toBeGreaterThan(-1);
    expect(top).toBeGreaterThan(hero);
    expect(rows).toBeGreaterThan(top);
    expect(screen.getByText('Basado en tus valoraciones')).toBeTruthy();
  });

  it('«Ver todo» solo aparece en filas con enlace', async () => {
    await render(<Home />);
    expect(screen.getAllByLabelText(/^Ver todo en /)).toHaveLength(1);
  });

  it('noAiScore: ningún texto de nota numérica ni porcentaje', async () => {
    await render(<Home />);
    const tree = userFacingText(screen.toJSON()).join(' | ');
    expect(tree).not.toMatch(/\b[1-5],\d\b/);
    expect(tree).not.toMatch(/\d+ ?%/);
    expect(tree.toLowerCase()).not.toContain('nota estimada');
    expect(tree).toContain('nota de IA oculta');
  });
});
