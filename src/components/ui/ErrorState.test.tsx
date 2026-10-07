import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('reintenta', async () => {
    const onRetry = jest.fn();
    await render(<ErrorState message="Fallo de red" onRetry={onRetry} />);
    expect(screen.getByText('Fallo de red')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
