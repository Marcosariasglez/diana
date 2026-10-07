import { fireEvent, render, screen } from '@testing-library/react-native';
import { Gallery } from './Gallery';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('Gallery', () => {
  it('renderiza todos los componentes y abre el BottomSheet', async () => {
    await render(<Gallery />);
    expect(screen.getByText('Galería de componentes')).toBeTruthy();
    expect(screen.getByLabelText('Predicción bloqueada')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Abrir BottomSheet'));
    expect(screen.getByText('Diario rápido')).toBeTruthy();
  });
});
