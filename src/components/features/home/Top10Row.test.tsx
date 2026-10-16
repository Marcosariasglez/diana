import { fireEvent, render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import type { FeedItem } from '@/types/media';
import { Top10Row } from './Top10Row';

const many: FeedItem[] = Array.from({ length: 12 }, (_, i) => ({
  media: { ...FIXTURE_MOVIES[0], id: 9000 + i, title: `Peli ${i + 1}` } as FeedItem['media'],
  bucket: 'medio' as const,
}));

describe('Top10Row', () => {
  it('muestra como máximo 10 ítems con label «Número N de tu Top 10: …»', async () => {
    await render(<Top10Row items={many} onPress={jest.fn()} />);
    expect(screen.getByLabelText('Número 1 de tu Top 10: Peli 1')).toBeTruthy();
    expect(screen.queryByLabelText(/Número 11 /)).toBeNull();
  });

  it('pulsar un ítem abre ese título', async () => {
    const onPress = jest.fn();
    await render(<Top10Row items={many} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Número 2 de tu Top 10: Peli 2'));
    expect(onPress).toHaveBeenCalledWith(many[1].media);
  });

  it('el número es decorativo y no hay notas', async () => {
    await render(<Top10Row items={many.slice(0, 3)} onPress={jest.fn()} />);
    expect(screen.getAllByTestId('rank-number', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.getByText('Top 10 para ti')).toBeTruthy();
  });

  it('sin ítems no pinta nada', async () => {
    await render(<Top10Row items={[]} onPress={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });
});
