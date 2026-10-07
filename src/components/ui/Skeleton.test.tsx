import { render, screen } from '@testing-library/react-native';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  it('renderiza', async () => {
    await render(<Skeleton width="100%" height={20} radius={10} />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
  });
});
