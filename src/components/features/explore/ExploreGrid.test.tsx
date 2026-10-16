import { fireEvent, render, screen } from '@testing-library/react-native';
import { ExploreGrid } from './ExploreGrid';
import type { Media, Movie } from '@/types/media';

const mockMovie = (id: number, title: string): Movie => ({
  id,
  media_type: 'movie',
  title,
  poster_path: `/p${id}.jpg`,
  backdrop_path: null,
  genres: [{ id: 28, name: 'Acción' }],
  overview: 'Test overview',
  vote_average: 7.5,
  vote_count: 100,
  popularity: 50,
  platforms: [],
  alt_titles: [],
  release_date: '2024-01-01',
  runtime: 120,
});

const mockItems: Media[] = [
  mockMovie(1, 'Película 1'),
  mockMovie(2, 'Película 2'),
  mockMovie(3, 'Película 3'),
];

describe('ExploreGrid', () => {
  it('muestra spinner cuando status=loading sin items', async () => {
    await render(
      <ExploreGrid
        items={[]}
        status="loading"
        hasMore={false}
        loadingMore={false}
        pageError={false}
        onLoadMore={jest.fn()}
        onPressItem={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Cargando títulos')).toBeTruthy();
  });

  it('muestra "Sin resultados" cuando items vacíos y status=ready', async () => {
    await render(
      <ExploreGrid
        items={[]}
        status="ready"
        hasMore={false}
        loadingMore={false}
        pageError={false}
        onLoadMore={jest.fn()}
        onPressItem={jest.fn()}
      />,
    );
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });

  it('muestra error con botón de reintento cuando status=error', async () => {
    const onRetry = jest.fn();
    await render(
      <ExploreGrid
        items={[]}
        status="error"
        hasMore={false}
        loadingMore={false}
        pageError={false}
        onLoadMore={jest.fn()}
        onPressItem={jest.fn()}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('No se pudo cargar el catálogo')).toBeTruthy();
    const retryBtn = screen.getByText('Reintentar');
    expect(retryBtn).toBeTruthy();
    await fireEvent.press(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('llama onPressItem con el Media al tocar un item', async () => {
    const onPressItem = jest.fn();
    await render(
      <ExploreGrid
        items={mockItems}
        status="ready"
        hasMore={false}
        loadingMore={false}
        pageError={false}
        onLoadMore={jest.fn()}
        onPressItem={onPressItem}
      />,
    );
    // Tocar el primer póster
    const firstCell = screen.getByRole('button', { name: 'Abrir Película 1' });
    expect(firstCell).toBeTruthy();
    await fireEvent.press(firstCell);
    expect(onPressItem).toHaveBeenCalledTimes(1);
    expect(onPressItem).toHaveBeenCalledWith(mockItems[0]);
  });

  it('llama onLoadMore al llegar al final (simulado)', async () => {
    const onLoadMore = jest.fn();
    await render(
      <ExploreGrid
        items={mockItems}
        status="ready"
        hasMore={true}
        loadingMore={false}
        pageError={false}
        onLoadMore={onLoadMore}
        onPressItem={jest.fn()}
      />,
    );
    // Los items deben estar visibles
    expect(screen.getByText('Película 1')).toBeTruthy();
    expect(screen.getByText('Película 2')).toBeTruthy();
    expect(screen.getByText('Película 3')).toBeTruthy();
  });

  it('muestra spinner de carga inferior cuando loadingMore con items', async () => {
    await render(
      <ExploreGrid
        items={mockItems}
        status="ready"
        hasMore={true}
        loadingMore={true}
        pageError={false}
        onLoadMore={jest.fn()}
        onPressItem={jest.fn()}
      />,
    );
    // Con items y status=loading, se muestra el grid + footer spinner
    expect(screen.getByText('Película 1')).toBeTruthy();
    // El footer ActivityIndicator debería estar presente
    expect(screen.getByLabelText('Cargando más títulos')).toBeTruthy();
  });
});
