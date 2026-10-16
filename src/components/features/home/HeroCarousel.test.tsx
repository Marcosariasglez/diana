import { fireEvent, render, screen } from '@testing-library/react-native';
import { FIXTURE_MOVIES } from '@/test/fixtures/catalog';
import type { FeedItem } from '@/types/media';
import { HeroCarousel, heroSize } from './HeroCarousel';

const items: FeedItem[] = FIXTURE_MOVIES.slice(0, 5).map((media) => ({ media, bucket: 'alto' as const }));
const inc = { nativeEvent: { actionName: 'increment' } };
const dec = { nativeEvent: { actionName: 'decrement' } };

describe('HeroCarousel', () => {
  it('pinta las tarjetas y el indicador «1 de N»', async () => {
    await render(<HeroCarousel items={items} onPress={jest.fn()} />);
    expect(screen.getByTestId('hero-dots').props.accessibilityLabel).toBe(`Para ti, 1 de ${items.length}`);
    expect(JSON.stringify(screen.toJSON())).toContain(`Para ti, 1 de ${items.length}:`);
  });

  it('la acción accesible «increment» pasa a la página siguiente', async () => {
    await render(<HeroCarousel items={items} onPress={jest.fn()} />);
    await fireEvent(screen.getByTestId('hero-dots'), 'accessibilityAction', inc);
    expect(screen.getByTestId('hero-dots').props.accessibilityLabel).toBe(`Para ti, 2 de ${items.length}`);
  });

  it('no pasa de la última ni de la primera', async () => {
    await render(<HeroCarousel items={items.slice(0, 2)} onPress={jest.fn()} />);
    for (let i = 0; i < 3; i++) await fireEvent(screen.getByTestId('hero-dots'), 'accessibilityAction', inc);
    expect(screen.getByTestId('hero-dots').props.accessibilityLabel).toBe('Para ti, 2 de 2');
    for (let i = 0; i < 3; i++) await fireEvent(screen.getByTestId('hero-dots'), 'accessibilityAction', dec);
    expect(screen.getByTestId('hero-dots').props.accessibilityLabel).toBe('Para ti, 1 de 2');
  });

  it('con un solo ítem no hay indicador', async () => {
    await render(<HeroCarousel items={items.slice(0, 1)} onPress={jest.fn()} />);
    expect(screen.queryByTestId('hero-dots')).toBeNull();
  });

  it('sin ítems no pinta nada', async () => {
    await render(<HeroCarousel items={[]} onPress={jest.fn()} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('heroSize: ancho = pantalla − 40, alto ≤ 440; en ancho ≥ 768 la tarjeta mide 520', () => {
    expect(heroSize(375)).toEqual({ width: 335, height: 431 });
    expect(heroSize(430).height).toBe(440);
    expect(heroSize(1024).width).toBe(520);
  });
});
