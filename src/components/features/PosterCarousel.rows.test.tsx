import { render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import { mediaYear } from './mediaHelpers';
import { PosterCarousel } from './PosterCarousel';

const items = FIXTURE_MOVIES.slice(0, 2).map((media) => ({ media, bucket: 'medio' as const }));

describe('PosterCarousel · subtítulo y año', () => {
  it('con subtitle lo pinta y lo lee junto al título', async () => {
    await render(<PosterCarousel items={items} onPress={jest.fn()} title="Para ti" subtitle="Porque te gustó Sicario" />);
    expect(screen.getByText('Porque te gustó Sicario')).toBeTruthy();
    expect(screen.getByLabelText('Para ti. Porque te gustó Sicario')).toBeTruthy();
  });

  it('con showYear pinta el año de cada póster', async () => {
    await render(<PosterCarousel items={items} onPress={jest.fn()} title="Fila" showYear />);
    expect(screen.getAllByText(String(mediaYear(items[0].media))).length).toBeGreaterThan(0);
  });

  it('por defecto no pinta año', async () => {
    await render(<PosterCarousel items={items} onPress={jest.fn()} title="Fila" />);
    expect(screen.queryByText(String(mediaYear(items[0].media)))).toBeNull();
  });
});
