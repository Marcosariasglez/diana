import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { Toast, ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="lanzar"
      onPress={() => toast.show('Guardado', 1000)}
    >
      <Text>x</Text>
    </Pressable>
  );
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('visible y oculto', async () => {
    const { rerender } = await render(<Toast message="Hola" visible />);
    expect(screen.getByText('Hola')).toBeTruthy();
    await rerender(<Toast message="Hola" visible={false} />);
    expect(screen.queryByText('Hola')).toBeNull();
  });
  it('ToastProvider muestra y oculta tras la duracion', async () => {
    await render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByLabelText('lanzar'));
    expect(screen.getByText('Guardado')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    expect(screen.queryByText('Guardado')).toBeNull();
  });
  it('useToast sin provider no rompe', async () => {
    await render(<Trigger />);
    await fireEvent.press(screen.getByLabelText('lanzar'));
  });
});
