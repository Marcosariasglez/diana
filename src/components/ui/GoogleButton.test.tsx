import { fireEvent, render, screen } from '@testing-library/react-native';
import { GoogleButton } from './GoogleButton';

describe('GoogleButton', () => {
  it('renderiza el texto oficial y dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<GoogleButton onPress={onPress} />);
    expect(screen.getByText('Continuar con Google')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('disabled no dispara onPress', async () => {
    const onPress = jest.fn();
    await render(<GoogleButton onPress={onPress} disabled />);
    const el = screen.getByRole('button', { name: 'Continuar con Google' });
    expect(el.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(el);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading muestra estado ocupado y no dispara', async () => {
    const onPress = jest.fn();
    await render(<GoogleButton onPress={onPress} loading />);
    const el = screen.getByRole('button', { name: 'Continuar con Google' });
    expect(el.props.accessibilityState.busy).toBe(true);
    await fireEvent.press(el);
    expect(onPress).not.toHaveBeenCalled();
  });
});
