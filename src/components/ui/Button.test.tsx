import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  it.each(['primary', 'secondary', 'google', 'destructive'] as const)('variante %s', async (variant) => {
    const onPress = jest.fn();
    await render(<Button label="Seguir" variant={variant} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Seguir' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('loading y disabled no disparan onPress', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Seguir" onPress={onPress} loading />);
    expect(screen.getByTestId('button-spinner')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Seguir' }));
    await rerender(<Button label="Seguir" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button', { name: 'Seguir' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
