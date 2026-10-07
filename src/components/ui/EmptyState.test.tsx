import { fireEvent, render, screen } from '@testing-library/react-native';
import { Film } from 'lucide-react-native';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('muestra titulo, mensaje y accion', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        icon={Film}
        title="Nada aun"
        message="Vuelve luego"
        action={{ label: 'Explorar', onPress }}
      />,
    );
    expect(screen.getByText('Nada aun')).toBeTruthy();
    expect(screen.getByText('Vuelve luego')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar' }));
    expect(onPress).toHaveBeenCalled();
  });
});
